/**
 * Turns a health profile and today's conditions into GraphHopper rules.
 * The numbers are fixed. Nothing here calls a model.
 */

export type HealthSensitivity = "asthma" | "copd" | "heat" | "none"

export type ExtraMinutesOk = 5 | 10 | 15 | "flexible"

export type PlanAirLevel = "good" | "acceptable" | "poor"

export interface HealthPlanProfile {
	sensitivities: HealthSensitivity[]
	mode: "walk" | "bike"
	extraMinutesOk?: ExtraMinutesOk
}

export interface AqhiPeriod {
	time: string
	aqhi: number
}

export interface HealthPlanConditions {
	airLevel: PlanAirLevel
	feelsLikeC: number | null
	heatWarning: boolean
	aqhiForecast?: AqhiPeriod[] | null
	/** True only when the graph encodes average_slope. This import does not. */
	elevationEnabled?: boolean
}

export interface CustomModel {
	priority: Array<{ if: string; multiply_by: string }>
	distance_influence?: number
}

export interface HealthPlan {
	customModel: CustomModel
	maxExtraS: number
	weights: { busy: number; climb: number; sun: number }
	preferShade: boolean
	shadeFeelsLikeC: number
	advisory: string | null
	tunedFor: string[]
}

const MOTORWAY = "road_class == MOTORWAY || road_class == TRUNK"

function priority (condition: string, factor: number) {
	return { if: condition, multiply_by: String(factor) }
}

function has (profile: HealthPlanProfile, name: HealthSensitivity): boolean {
	return profile.sensitivities.includes(name)
}

function breathing (profile: HealthPlanProfile): boolean {
	return has(profile, "asthma") || has(profile, "copd")
}

function extraSeconds (value: ExtraMinutesOk | undefined): number {
	if (value === "flexible") {
		return Number.POSITIVE_INFINITY
	}
	const minutes = value === 5 || value === 15 ? value : 10
	return minutes * 60
}

function laterAir (periods: AqhiPeriod[] | null | undefined): string {
	const better = periods?.find((period) => period.aqhi <= 3)
	if (!better) {
		return ""
	}
	return ` The AQHI forecast is ${better.aqhi} around ${better.time}.`
}

/**
 * Build the custom model, the time budget, and the cost weights for one trip.
 * Every multiply_by value is at most 1.
 */
export function buildHealthPlan (
	profile: HealthPlanProfile,
	conditions: HealthPlanConditions,
): HealthPlan {
	const lungs = breathing(profile)
	const heatSensitive = has(profile, "heat")
	const poor = conditions.airLevel === "poor" && lungs
	const feels = conditions.feelsLikeC
	const shadeFeelsLikeC = heatSensitive ? 25 : 30
	const preferShade = feels != null && feels >= shadeFeelsLikeC
	const rules = [priority(MOTORWAY, 0)]

	if (poor) {
		rules.push(
			priority("road_class == PRIMARY", 0.05),
			priority("road_class == SECONDARY", 0.2),
			priority("road_class == TERTIARY", 0.5),
			priority("max_speed >= 50", 0.4),
		)
	} else if (lungs) {
		rules.push(
			priority("road_class == PRIMARY", 0.2),
			priority("road_class == SECONDARY", 0.5),
			priority("max_speed >= 50", 0.6),
		)
	}

	const customModel: CustomModel = { priority: rules }
	if (has(profile, "copd")) {
		customModel.distance_influence = 140
		if (conditions.elevationEnabled) {
			rules.push(priority("average_slope > 4", 0.5))
		}
	}
	// No tree canopy is on this graph. When shade matters, ask GraphHopper for
	// paths that spend less time on the wide roads shade.ts treats as unshaded.
	if (preferShade && !lungs) {
		rules.push(
			priority("road_class == PRIMARY", 0.4),
			priority("road_class == SECONDARY", 0.6),
		)
	}

	const tunedFor: string[] = []
	if (has(profile, "asthma")) {
		tunedFor.push("asthma")
	}
	if (has(profile, "copd")) {
		tunedFor.push("copd")
	}
	if (heatSensitive) {
		tunedFor.push("heat")
	}
	if (poor) {
		tunedFor.push("poor air today")
	}
	if (preferShade) {
		tunedFor.push("shade")
	}

	const notes: string[] = []
	if (poor) {
		notes.push(
			`Air is poor for your lungs. The metro, or a later time, is a better trip today.${laterAir(conditions.aqhiForecast)}`,
		)
	}
	if (conditions.heatWarning && heatSensitive) {
		notes.push(
			"A heat warning is in effect. A cooler hour or the metro is easier on you.",
		)
	}

	let sun = 0
	if (preferShade) {
		sun = heatSensitive && feels != null && feels >= 30 ? 1 : 0.5
	}

	return {
		customModel,
		maxExtraS: extraSeconds(profile.extraMinutesOk),
		weights: {
			busy: poor ? 4 : lungs ? 2 : 1,
			climb: has(profile, "copd") ? 0.05 : 0,
			sun,
		},
		preferShade,
		shadeFeelsLikeC,
		advisory: notes.length > 0 ? notes.join(" ") : null,
		tunedFor,
	}
}
