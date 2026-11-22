import type { Place, RoutesResponse, Sensitivity } from "@/lib/types"

export interface SavedProfile {
	asthma: Sensitivity | null
	copd: Sensitivity | null
	heat: Sensitivity | null
	mode?: "walk" | "bike" | null
	extraMinutesOk?: 5 | 10 | 15 | "flexible"
}

export type AssistantHint = "directions" | "conditions" | "places"

export type AssistantLanguage = "en" | "fr"

export type TimeOfDay = "morning" | "afternoon" | "evening" | "now"

export interface ParsedTrip {
	intent: AssistantHint | "unclear"
	fromText: string | null
	toText: string | null
	mode: "walk" | "bike" | null
	timeOfDay: TimeOfDay | null
	activity: string | null
	mentionedSensitivities: Array<"asthma" | "copd" | "heat">
	language: AssistantLanguage
}

export interface ConditionsSnapshot {
	placeLabel: string
	airLevel: "good" | "acceptable" | "poor" | "unknown"
	aqi: number
	levelLabel: string
	mainPollutant: "o3" | "pm25" | "no2" | null
	feelsLikeC: number
	heatWarning: boolean
	aqhiCategory: "low" | "moderate" | "high" | "very-high"
}

export interface GuidanceSource {
	id: string
	source: string
	url: string
	detail?: string
}

export interface AssistantTripRoute {
	id: "fast" | "clean"
	label: string
	durationSeconds: number
	distanceMeters: number
	busyShare: number
	busyMinutes?: number | null
	mainStreets: string[] | null
	shadeShare: number | null
}

/** GraphHopper result already on screen, so a follow-up does not re-route. */
export interface AssistantTrip {
	origin: Place
	destination: Place
	mode: "walk" | "bike"
	strictMode: boolean
	tradeoff: string
	routes: AssistantTripRoute[]
	tunedFor?: string[]
	advisory?: string | null
	healthCost?: number | null
	busyMinutes?: { fast: number; clean: number } | null
	shadePct?: { fast: number | null; clean: number | null } | null
}

export interface DirectionsReply {
	kind: "directions"
	language: AssistantLanguage
	parsed: ParsedTrip
	origin: Place
	destination: Place
	directions: RoutesResponse
	explanation: string
	sources: GuidanceSource[]
	note: string
}

export interface ConditionsReply {
	kind: "conditions"
	language: AssistantLanguage
	parsed: ParsedTrip
	answer: string
	conditions: ConditionsSnapshot
	sources: GuidanceSource[]
	note: string
}

export interface ClarifyReply {
	kind: "clarify"
	language: AssistantLanguage
	question: string
	parsed: ParsedTrip
	sources: GuidanceSource[]
	note: string
}

export type AssistantReply = DirectionsReply | ConditionsReply | ClarifyReply

export interface AssistantRequestBody {
	message: string
	profile: SavedProfile
	userLocation?: Place | null
	hint?: AssistantHint | null
	parsed?: ParsedTrip | null
	prior?: ParsedTrip | null
	history?: Array<{ role: "user" | "assistant"; text: string }>
	trip?: AssistantTrip | null
}

export function replyText (reply: AssistantReply | undefined): string {
	if (!reply) {
		return ""
	}
	if (reply.kind === "clarify") {
		return reply.question
	}
	if (reply.kind === "directions") {
		return reply.explanation
	}
	return reply.answer
}

export interface ChatMessage {
	id: string
	role: "user" | "assistant"
	text?: string
	reply?: AssistantReply
}
