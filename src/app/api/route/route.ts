import { getDirections } from "@/lib/get-directions"
import type { HealthSensitivity } from "@/lib/health-routing"
import type { Place, Sensitivity, TravelMode } from "@/lib/types"

interface RouteBody {
	origin?: Place
	destination?: Place
	profile?: {
		asthma?: Sensitivity | null
		copd?: Sensitivity | null
		heat?: Sensitivity | null
		mode?: TravelMode
		extraMinutesOk?: 5 | 10 | 15 | "flexible"
	}
	air_level?: string
	poor_air?: boolean
	feels_like_c?: number | null
	heat_warning?: boolean
	aqhi_forecast?: Array<{ time: string; aqhi: number }> | null
}

function placeOk (place: Place | undefined): place is Place {
	return !!place
		&& Number.isFinite(place.lat)
		&& Number.isFinite(place.lon)
}

function counts (level: Sensitivity | null | undefined): boolean {
	return level === "medium" || level === "high"
}

export async function POST (request: Request) {
	let body: RouteBody
	try {
		body = (await request.json()) as RouteBody
	} catch {
		return Response.json({ detail: "Invalid JSON" }, { status: 400 })
	}
	if (!placeOk(body.origin) || !placeOk(body.destination) || !body.profile?.mode) {
		return Response.json(
			{ detail: "Origin, destination, and mode are required." },
			{ status: 400 },
		)
	}
	const sensitivities: HealthSensitivity[] = []
	if (counts(body.profile.asthma)) {
		sensitivities.push("asthma")
	}
	if (counts(body.profile.copd)) {
		sensitivities.push("copd")
	}
	if (counts(body.profile.heat)) {
		sensitivities.push("heat")
	}
	const airLevel = body.air_level === "good" || body.air_level === "acceptable" || body.air_level === "poor"
		? body.air_level
		: body.poor_air ? "poor" : "acceptable"
	try {
		const routes = await getDirections(
			body.origin,
			body.destination,
			{
				sensitivities: sensitivities.length > 0 ? sensitivities : ["none"],
				mode: body.profile.mode,
				extraMinutesOk: body.profile.extraMinutesOk,
			},
			{
				airLevel,
				feelsLikeC: typeof body.feels_like_c === "number" ? body.feels_like_c : null,
				heatWarning: body.heat_warning === true,
				aqhiForecast: body.aqhi_forecast ?? null,
			},
		)
		return Response.json(routes)
	} catch (error) {
		const detail = error instanceof Error ? error.message : "Could not find routes."
		return Response.json({ detail }, { status: 503 })
	}
}
