import type { Place, RoutesResponse, Sensitivity } from "@/lib/types"

export interface SavedProfile {
	asthma: Sensitivity | null
	copd: Sensitivity | null
	heat: Sensitivity | null
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
}

export interface DirectionsReply {
	kind: "directions"
	language: AssistantLanguage
	parsed: ParsedTrip
	origin: Place
	destination: Place
	directions: RoutesResponse
	explanation: string
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
}

export interface ChatMessage {
	id: string
	role: "user" | "assistant"
	text?: string
	reply?: AssistantReply
}
