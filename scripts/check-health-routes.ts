import { buildHealthPlan } from "../src/lib/health-routing"
import { ELEVATION_ENABLED, getDirections } from "../src/lib/get-directions"

const origin = { lat: 45.5017, lon: -73.5673 }
const destination = { lat: 45.4796, lon: -73.5773 }

function plan (sensitivities: Array<"none" | "asthma" | "copd" | "heat">, air: "good" | "poor", feels: number, elevation = false) {
	return buildHealthPlan(
		{ sensitivities, mode: "bike", extraMinutesOk: 10 },
		{
			airLevel: air,
			feelsLikeC: feels,
			heatWarning: false,
			elevationEnabled: elevation,
		},
	)
}

function show (label: string, value: ReturnType<typeof plan>) {
	console.log("\n" + label)
	console.log(JSON.stringify({
		tunedFor: value.tunedFor,
		weights: value.weights,
		preferShade: value.preferShade,
		shadeFeelsLikeC: value.shadeFeelsLikeC,
		maxExtraS: value.maxExtraS,
		advisory: value.advisory,
		distance: value.customModel.distance_influence ?? null,
		rules: value.customModel.priority,
	}, null, 2))
}

show("none", plan(["none"], "good", 18))
show("asthma", plan(["asthma"], "good", 18))
show("asthma poor", plan(["asthma"], "poor", 18))
show("copd elevation", plan(["copd"], "good", 18, true))
show("heat 33", plan(["heat"], "good", 33))

async function trip (label: string, sensitivities: Array<"none" | "asthma" | "copd" | "heat">, air: "good" | "poor", feels: number) {
	const result = await getDirections(
		origin,
		destination,
		{ sensitivities, mode: "bike", extraMinutesOk: 10 },
		{ airLevel: air, feelsLikeC: feels, heatWarning: false, elevationEnabled: ELEVATION_ENABLED },
	)
	const fast = result.routes[0]
	const health = result.routes[1]
	const signature = (coords: number[][]) => coords.slice(0, 3).map((pair) => pair.map((n) => n.toFixed(4)).join(",")).join(" | ")
	console.log("\nTRIP", label)
	console.log(JSON.stringify({
		tunedFor: result.tuned_for,
		advisory: result.advisory,
		healthCost: result.health_cost,
		busyMinutes: result.busy_minutes,
		shadePct: result.shade_pct,
		fastMin: Math.round(fast.duration_seconds / 60),
		healthMin: Math.round(health.duration_seconds / 60),
		fastMetres: fast.distance_meters,
		healthMetres: health.distance_meters,
		sameLine: signature(fast.geometry.coordinates) === signature(health.geometry.coordinates)
			&& fast.distance_meters === health.distance_meters,
		tradeoff: result.tradeoff,
	}, null, 2))
}

async function main () {
	await trip("none", ["none"], "good", 18)
	await trip("asthma", ["asthma"], "good", 18)
	await trip("asthma poor", ["asthma"], "poor", 18)
	await trip("copd", ["copd"], "good", 18)
	await trip("heat 33", ["heat"], "good", 33)
	await trip("heat 20", ["heat"], "good", 20)
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
