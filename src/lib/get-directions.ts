import {
	buildHealthPlan,
	type AqhiPeriod,
	type ExtraMinutesOk,
	type HealthPlan,
	type HealthSensitivity,
	type PlanAirLevel,
} from "@/lib/health-routing"
import { shadeFromRoadClass, type ShadeEstimate } from "@/lib/shade"
import type { RoutesResponse, TravelMode } from "@/lib/types"

const GRAPHHOPPER_URL = process.env.GRAPHHOPPER_URL || "http://127.0.0.1:8989"
const DRIVING_G_PER_KM = 251
const BUSY = new Set(["motorway", "trunk", "primary", "secondary"])

/** This Montréal graph does not encode average_slope, so the slope rule stays off. */
export const ELEVATION_ENABLED = false

export interface DirectionPoint {
	lat: number
	lon: number
}

export interface DirectionProfile {
	sensitivities: HealthSensitivity[]
	mode: TravelMode
	extraMinutesOk?: ExtraMinutesOk
}

export interface DirectionConditions {
	airLevel: PlanAirLevel
	feelsLikeC: number | null
	heatWarning: boolean
	aqhiForecast?: AqhiPeriod[] | null
	elevationEnabled?: boolean
}

interface GhPath {
	time: number
	distance: number
	ascend?: number
	points?: { coordinates?: number[][] }
	details?: { road_class?: Array<[number, number, string]> }
}

interface ScoredPath {
	path: GhPath
	seconds: number
	minutes: number
	busyMinutes: number
	climbMetres: number
	shade: ShadeEstimate | null
	cost: number
}

function metresBetween (a: number[], b: number[]): number {
	const lat = ((a[1] + b[1]) / 2) * (Math.PI / 180)
	const dx = (b[0] - a[0]) * 111320 * Math.cos(lat)
	const dy = (b[1] - a[1]) * 110540
	return Math.hypot(dx, dy)
}

function classMinutes (
	path: GhPath,
	minutes: number,
	classes: Set<string>,
): number {
	const coordinates = path.points?.coordinates ?? []
	const rows = path.details?.road_class
	if (!rows?.length || coordinates.length < 2 || minutes <= 0) {
		return 0
	}
	let total = 0
	let busy = 0
	for (const [from, to, name] of rows) {
		let length = 0
		const end = Math.min(to, coordinates.length - 1)
		for (let index = from; index < end; index += 1) {
			length += metresBetween(coordinates[index], coordinates[index + 1])
		}
		total += length
		if (classes.has(String(name).toLowerCase())) {
			busy += length
		}
	}
	if (total <= 0) {
		return 0
	}
	return Math.round((busy / total) * minutes * 10) / 10
}

function scorePath (path: GhPath, plan: HealthPlan): ScoredPath {
	const seconds = path.time / 1000
	const minutes = seconds / 60
	const busyMinutes = classMinutes(path, minutes, BUSY)
	const climbMetres = typeof path.ascend === "number" ? path.ascend : 0
	const shade = plan.preferShade
		? shadeFromRoadClass(
			path.points?.coordinates ?? [],
			path.details?.road_class,
			seconds,
		)
		: null
	const unshaded = shade?.unshadedMinutes ?? 0
	const cost = minutes
		+ plan.weights.busy * busyMinutes
		+ plan.weights.climb * climbMetres
		+ plan.weights.sun * unshaded
	return { path, seconds, minutes, busyMinutes, climbMetres, shade, cost }
}

async function graphhopper (
	origin: DirectionPoint,
	destination: DirectionPoint,
	mode: TravelMode,
	plan: HealthPlan | null,
	alternatives: boolean,
): Promise<GhPath[]> {
	const body: Record<string, unknown> = {
		points: [
			[origin.lon, origin.lat],
			[destination.lon, destination.lat],
		],
		profile: mode === "bike" ? "bike" : "foot",
		details: ["road_class"],
		points_encoded: false,
		"ch.disable": true,
	}
	if (plan) {
		body.custom_model = plan.customModel
	}
	if (alternatives) {
		body.algorithm = "alternative_route"
		body["alternative_route.max_paths"] = 3
	}
	let response: Response
	try {
		response = await fetch(`${GRAPHHOPPER_URL}/route`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(12000),
		})
	} catch {
		throw new Error("The route service is not running.")
	}
	if (!response.ok) {
		let detail = "GraphHopper could not route this trip."
		try {
			const payload = await response.json() as { message?: string }
			if (payload.message) {
				detail = payload.message
			}
		} catch {
			detail = "GraphHopper could not route this trip."
		}
		throw new Error(detail)
	}
	const data = await response.json() as { paths?: GhPath[] }
	return data.paths ?? []
}

function toOption (
	id: "fast" | "clean",
	label: string,
	scored: ScoredPath,
	lines: string[],
) {
	const coordinates = scored.path.points?.coordinates ?? []
	const share = scored.minutes > 0 ? scored.busyMinutes / scored.minutes : 0
	return {
		id,
		label,
		duration_seconds: Math.round(scored.seconds),
		distance_meters: Math.round(scored.path.distance),
		busy_time_seconds: Math.round(scored.busyMinutes * 60),
		busy_share: Math.round(share * 1000) / 1000,
		trip_co2_g: 0,
		driving_co2_g: Math.round((scored.path.distance / 1000) * DRIVING_G_PER_KM * 10) / 10,
		geometry: { type: "LineString" as const, coordinates },
		explanations: lines,
	}
}

function tradeoff (fast: ScoredPath, health: ScoredPath): string {
	const extraMin = Math.round((health.seconds - fast.seconds) / 60)
	const busyDrop = Math.round((fast.busyMinutes - health.busyMinutes) * 10) / 10
	if (extraMin <= 0 && busyDrop <= 0) {
		return "The health route matches the fastest route on time and busy roads."
	}
	const time = extraMin <= 0
		? "is no longer than the fastest"
		: `takes ${extraMin} min longer`
	const busy = busyDrop > 0
		? ` and spends ${busyDrop} fewer minutes on busy roads`
		: ""
	return `The health route ${time}${busy}.`
}

/**
 * Fastest route uses the plain bike or foot profile.
 * The health route is the lowest-cost alternative inside the extra-time budget.
 * Flexible ignores that budget and keeps the lowest cost at any length.
 */
export async function getDirections (
	origin: DirectionPoint,
	destination: DirectionPoint,
	profile: DirectionProfile,
	conditions: DirectionConditions,
): Promise<RoutesResponse> {
	const plan = buildHealthPlan(profile, {
		...conditions,
		elevationEnabled: conditions.elevationEnabled ?? ELEVATION_ENABLED,
	})
	const [fastPaths, healthPaths] = await Promise.all([
		graphhopper(origin, destination, profile.mode, null, false),
		graphhopper(origin, destination, profile.mode, plan, true),
	])
	const fastest = fastPaths[0]
	if (!fastest) {
		throw new Error("No route was found between those places.")
	}
	const fastScore = scorePath(fastest, plan)
	const limit = fastScore.seconds + plan.maxExtraS
	let chosen: ScoredPath | null = null
	const seen = new Set<string>()
	for (const path of healthPaths) {
		const key = `${path.time}:${Math.round(path.distance)}`
		if (seen.has(key)) {
			continue
		}
		seen.add(key)
		const scored = scorePath(path, plan)
		if (scored.seconds > limit + 0.5) {
			continue
		}
		if (!chosen) {
			chosen = scored
			continue
		}
		const cheaper = scored.cost < chosen.cost - 0.001
		const tie = Math.abs(scored.cost - chosen.cost) <= 0.001
			&& scored.seconds < chosen.seconds
		if (cheaper || tie) {
			chosen = scored
		}
	}
	if (!chosen) {
		chosen = fastScore
	}

	const fastShade = shadeFromRoadClass(
		fastest.points?.coordinates ?? [],
		fastest.details?.road_class,
		fastScore.seconds,
	)
	const healthShade = chosen.shade ?? shadeFromRoadClass(
		chosen.path.points?.coordinates ?? [],
		chosen.path.details?.road_class,
		chosen.seconds,
	)
	const lines = [
		...(plan.tunedFor.length > 0 ? [`Tuned for ${plan.tunedFor.join(", ")}.`] : []),
		...(plan.advisory ? [plan.advisory] : []),
	]
	const suggest = conditions.airLevel === "poor"
		|| (conditions.heatWarning && profile.sensitivities.includes("heat"))

	return {
		tradeoff: tradeoff(fastScore, chosen),
		suggest_metro: suggest,
		routes: [
			toOption("fast", "Fastest", fastScore, []),
			toOption("clean", "Health route", chosen, lines),
		],
		tuned_for: plan.tunedFor,
		advisory: plan.advisory,
		health_cost: Math.round(chosen.cost * 10) / 10,
		busy_minutes: {
			fast: fastScore.busyMinutes,
			clean: chosen.busyMinutes,
		},
		shade_pct: {
			fast: fastShade?.shadePct ?? null,
			clean: healthShade?.shadePct ?? null,
		},
	}
}
