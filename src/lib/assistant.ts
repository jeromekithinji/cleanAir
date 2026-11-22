import OpenAI from "openai"
import { z } from "zod"
import type { Place } from "@/lib/types"
import {
	SAMPLE_ORIGIN,
	SAMPLE_PLACES,
	sampleTrip,
	searchPlaces,
	type SamplePlace,
} from "@/lib/sample-trip"
import { buildTags, selectGuidance, type GuidanceSensitivity } from "@/lib/guidance"
import type {
	AssistantLanguage,
	AssistantReply,
	AssistantRequestBody,
	ConditionsSnapshot,
	ParsedTrip,
	SavedProfile,
} from "@/lib/assistant-types"

const PLACE_ALIASES: Array<[string, string]> = [
	["atwater", "Atwater Market"],
	["jean-talon", "Jean-Talon Market"],
	["jean talon", "Jean-Talon Market"],
	["la fontaine", "Parc La Fontaine"],
	["vieux-port", "Old Port"],
	["vieux port", "Old Port"],
	["old port", "Old Port"],
	["mont-royal", "Mount Royal chalet"],
	["mont royal", "Mount Royal chalet"],
	["mount royal", "Mount Royal chalet"],
	["centre-ville", "Downtown"],
	["downtown", "Downtown"],
]

const parsedSchema = z.object({
	intent: z.enum(["directions", "conditions", "places", "unclear"]),
	fromText: z.string().nullable(),
	toText: z.string().nullable(),
	mode: z.enum(["walk", "bike"]).nullable(),
	timeOfDay: z.enum(["morning", "afternoon", "evening", "now"]).nullable(),
	activity: z.string().nullable(),
	mentionedSensitivities: z.array(z.enum(["asthma", "copd", "heat"])),
	language: z.enum(["en", "fr"]),
})

const explanationSchema = z.object({
	explanation: z.string().min(1),
})

const answerSchema = z.object({
	answer: z.string().min(1),
	usedSnippetIds: z.array(z.string()),
})

/**
 * Answer one assistant turn. Air, weather, and routing are sample data
 * until those services are connected.
 */
export async function handleAssistant (
	body: AssistantRequestBody,
): Promise<AssistantReply> {
	const message = body.message.trim()
	const fresh = body.parsed ?? (await parseRequest(message, body.hint ?? null, body.history ?? []))
	const merged = withKnownPlace(mergePrior(fresh, body.prior ?? null, message), message)
	const hinted = body.hint ?? merged.intent
	const intent = hinted === "unclear" && merged.toText ? "directions" : hinted
	const understood = { ...merged, intent }

	if (intent === "directions") {
		return planDirections(message, understood, body)
	}
	if (intent === "conditions" || intent === "places") {
		return describeConditions(message, understood, body, intent)
	}
	return {
		kind: "clarify",
		language: understood.language,
		question: clarifyQuestion(understood),
		parsed: understood,
	}
}

async function parseRequest (
	message: string,
	hint: AssistantRequestBody["hint"],
	history: Array<{ role: "user" | "assistant"; text: string }>,
): Promise<ParsedTrip> {
	const fallback = templateParse(message, hint ?? null)
	const transcript = history
		.map((turn) => `${turn.role}: ${turn.text}`)
		.join("\n")
	const parsed = await completeJson(
		parsedSchema,
		[
			"You extract a trip request for a Montréal clean-air assistant.",
			"Reply with JSON only, using this shape:",
			"{ intent, fromText, toText, mode, timeOfDay, activity,",
			"mentionedSensitivities, language }.",
			"Known places: Atwater Market, Jean-Talon Market, Parc La Fontaine,",
			"Old Port, Mount Royal chalet, Downtown.",
			"Correct typos to one of those names. awater means Atwater Market.",
			"intent is directions, conditions, places, or unclear.",
			"A request to bike or walk somewhere is directions.",
			"conditions asks if an activity is okay.",
			"places asks what kind of place to go, not a named venue.",
			"unclear is only for vague requests like 'somewhere nice' with no place.",
			"Keep the destination, origin, and mode from earlier turns unless the user changes them.",
			"fromText is my location when they say from here or from my location.",
			"mode is walk, bike, or null. timeOfDay is morning, afternoon, evening, now, or null.",
			"mentionedSensitivities is any of asthma, copd, heat.",
			"language is fr when the user writes French, otherwise en.",
			"Use null for unknown strings.",
		].join(" "),
		transcript ? `${transcript}\nuser: ${message}` : message,
	)
	if (!parsed) {
		return fallback
	}
	return hint ? { ...parsed, intent: hint } : parsed
}

async function planDirections (
	message: string,
	parsed: ParsedTrip,
	body: AssistantRequestBody,
): Promise<AssistantReply> {
	const destination = findPlace(parsed.toText) ?? findPlace(message)
	if (!destination) {
		return {
			kind: "clarify",
			language: parsed.language,
			question: clarifyQuestion(parsed),
			parsed,
		}
	}
	const origin = resolveOrigin(parsed, body.userLocation ?? null)
	const directions = sampleTrip(origin, destination)
	if (!directions) {
		return {
			kind: "clarify",
			language: parsed.language,
			question: clarifyQuestion(parsed),
			parsed,
		}
	}
	const snapshot = dummyConditions(destination)
	const snippets = matchedSnippets(message, parsed, body.profile, snapshot, "routes")
	const generated = await completeJson(
		explanationSchema,
		[
			"Explain a clean-air walking or biking route in one or two sentences.",
			"Use the route tradeoff and the guidance snippets. Do not give medical advice.",
			parsed.language === "fr"
				? "Reply in French."
				: "Reply in English.",
			'JSON shape: { "explanation": string }.',
		].join(" "),
		JSON.stringify({
			tradeoff: directions.tradeoff,
			snippets: snippets.map((snippet) => snippet.text),
		}),
	)
	return {
		kind: "directions",
		language: parsed.language,
		parsed: { ...parsed, toText: destination.label },
		origin,
		destination,
		directions,
		explanation: generated?.explanation ?? templateExplanation(parsed.language, directions.tradeoff),
	}
}

async function describeConditions (
	message: string,
	parsed: ParsedTrip,
	body: AssistantRequestBody,
	intent: "conditions" | "places",
): Promise<AssistantReply> {
	const named = findPlace(parsed.toText) ?? findPlace(message)
	const point = named ?? body.userLocation ?? SAMPLE_ORIGIN
	const snapshot = dummyConditions(point)
	const topic = intent === "places" ? "places" : "forecast"
	const snippets = matchedSnippets(message, parsed, body.profile, snapshot, topic)
	const generated = await completeJson(
		answerSchema,
		[
			"Answer using only the supplied guidance snippets.",
			intent === "places"
				? "Suggest kinds of places (indoors, shade, near water), not specific venues."
				: "Say whether the activity is a reasonable idea right now.",
			"Do not give medical advice or name a dose.",
			parsed.language === "fr"
				? "Write the answer in French."
				: "Write the answer in English.",
			'JSON shape: { "answer": string, "usedSnippetIds": string[] }.',
		].join(" "),
		JSON.stringify({
			question: message,
			conditions: snapshot,
			snippets: snippets.map((snippet) => ({
				id: snippet.id,
				text: snippet.text,
			})),
		}),
	)
	const used = new Set(generated?.usedSnippetIds ?? [])
	const chosen = snippets.filter((snippet) => used.has(snippet.id))
	const sources = (chosen.length > 0 ? chosen : snippets).map((snippet) => ({
		id: snippet.id,
		source: snippet.source,
		url: snippet.url,
	}))
	return {
		kind: "conditions",
		language: parsed.language,
		parsed,
		answer:
			generated?.answer ??
			templateConditionsAnswer(parsed.language, intent),
		conditions: snapshot,
		sources,
		note: medicalNote(parsed.language),
	}
}

function matchedSnippets (
	message: string,
	parsed: ParsedTrip,
	profile: SavedProfile,
	snapshot: ConditionsSnapshot,
	topic: "routes" | "places" | "forecast",
) {
	const sensitivities = new Set<GuidanceSensitivity>(parsed.mentionedSensitivities)
	if (profile.asthma === "medium" || profile.asthma === "high") {
		sensitivities.add("asthma")
	}
	if (profile.copd === "medium" || profile.copd === "high") {
		sensitivities.add("copd")
	}
	if (profile.heat === "medium" || profile.heat === "high") {
		sensitivities.add("heat")
	}
	const tags = buildTags(
		{
			airLevel: snapshot.airLevel,
			aqhiCategory: snapshot.aqhiCategory,
			mainPollutant: snapshot.mainPollutant,
			heatWarning: snapshot.heatWarning,
			feelsLikeC: snapshot.feelsLikeC,
		},
		[...sensitivities],
		message,
		topic,
	)
	return selectGuidance(tags, 5)
}

/**
 * Sample air and heat for the whole city until the live feed is connected.
 * Moderate air, ozone, and a heat warning, so guidance has something to match.
 */
function dummyConditions (place: Place): ConditionsSnapshot {
	return {
		placeLabel: place.label,
		airLevel: "acceptable",
		aqi: 5,
		levelLabel: "Moderate",
		mainPollutant: "o3",
		feelsLikeC: 31,
		heatWarning: true,
		aqhiCategory: "moderate",
	}
}

function resolveOrigin (parsed: ParsedTrip, userLocation: Place | null): Place {
	const from = parsed.fromText?.trim().toLowerCase() ?? ""
	const here =
		from === "" ||
		from === "your location" ||
		from === "my location" ||
		from === "here" ||
		from === "ici" ||
		from === "ma position"
	if (here && userLocation) {
		return userLocation
	}
	return findPlace(parsed.fromText) ?? userLocation ?? SAMPLE_ORIGIN
}

function normalizePlace (text: string): string {
	return text
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
}

function editDistance (left: string, right: string): number {
	const row = Array.from({ length: right.length + 1 }, (_, index) => index)
	for (let i = 1; i <= left.length; i += 1) {
		let previous = row[0] ?? 0
		row[0] = i
		for (let j = 1; j <= right.length; j += 1) {
			const current = row[j] ?? 0
			const cost = left[i - 1] === right[j - 1] ? 0 : 1
			row[j] = Math.min(
				current + 1,
				(row[j - 1] ?? 0) + 1,
				previous + cost,
			)
			previous = current
		}
	}
	return row[right.length] ?? 0
}

const SKIP_WORDS = new Set([
	"bike",
	"biking",
	"walk",
	"walking",
	"from",
	"want",
	"market",
	"parc",
	"park",
	"chalet",
])

export function findPlace (text: string | null): SamplePlace | null {
	if (!text) {
		return null
	}
	const needle = normalizePlace(text)
	for (const [alias, label] of PLACE_ALIASES) {
		if (needle.includes(alias)) {
			return SAMPLE_PLACES.find((place) => place.label === label) ?? null
		}
	}
	const words = needle.split(/[^a-z0-9]+/).filter((word) => word.length >= 5)
	let best: { place: SamplePlace; score: number } | null = null
	for (const place of SAMPLE_PLACES) {
		const tokens = normalizePlace(place.label)
			.split(/[^a-z0-9]+/)
			.filter((token) => token.length >= 5 && !SKIP_WORDS.has(token))
		for (const word of words) {
			if (SKIP_WORDS.has(word)) {
				continue
			}
			for (const token of tokens) {
				const distance = editDistance(word, token)
				const limit = Math.max(token.length, word.length) >= 7 ? 2 : 1
				if (distance > limit) {
					continue
				}
				const score = token.length - distance
				if (!best || score > best.score) {
					best = { place, score }
				}
			}
		}
	}
	return best?.place ?? searchPlaces(text)[0] ?? null
}

function withKnownPlace (parsed: ParsedTrip, message: string): ParsedTrip {
	const named = findPlace(parsed.toText) ?? findPlace(message)
	if (!named) {
		return parsed
	}
	return { ...parsed, toText: named.label }
}

function mergePrior (
	parsed: ParsedTrip,
	prior: ParsedTrip | null,
	message: string,
): ParsedTrip {
	if (!prior) {
		return parsed
	}
	const fromHere = /\b(my location|from here|from my location|ici)\b/i.test(message)
	return {
		...parsed,
		toText: parsed.toText ?? prior.toText,
		fromText: parsed.fromText ?? (fromHere ? "my location" : prior.fromText),
		mode: parsed.mode ?? prior.mode,
		timeOfDay: parsed.timeOfDay ?? prior.timeOfDay,
		activity: parsed.activity ?? prior.activity,
		mentionedSensitivities: parsed.mentionedSensitivities.length > 0
			? parsed.mentionedSensitivities
			: prior.mentionedSensitivities,
		language: parsed.language,
	}
}

function templateParse (
	message: string,
	hint: AssistantRequestBody["hint"],
): ParsedTrip {
	const language = looksFrench(message) ? "fr" : "en"
	const lower = message.toLowerCase()
	const place = findPlace(message)
	let intent: ParsedTrip["intent"] = hint ?? "unclear"
	if (!hint) {
		if (/\b(where can i go|somewhere to go|ou puis-je|où puis-je|endroit)\b/.test(lower)) {
			intent = "places"
		} else if (/\b(is it okay|can i|safe to|puis-je|est-ce que)\b/.test(lower)) {
			intent = "conditions"
		} else if (place && /\b(to|au|aux|vers|going|vais|bike|velo|vélo|walk)\b/.test(lower)) {
			intent = "directions"
		}
	}
	const mentioned: ParsedTrip["mentionedSensitivities"] = []
	if (/asthma|asthme/.test(lower)) {
		mentioned.push("asthma")
	}
	if (/\bcopd\b|mpoc/.test(lower)) {
		mentioned.push("copd")
	}
	if (/\bheat\b|chaleur/.test(lower)) {
		mentioned.push("heat")
	}
	let mode: ParsedTrip["mode"] = null
	if (/\b(bike|biking|cycling|velo|vélo)\b/.test(lower)) {
		mode = "bike"
	} else if (/\b(walk|walking|marche|à pied|a pied)\b/.test(lower)) {
		mode = "walk"
	}
	let timeOfDay: ParsedTrip["timeOfDay"] = null
	if (/afternoon|apres-midi|après-midi/.test(lower)) {
		timeOfDay = "afternoon"
	} else if (/evening|soir/.test(lower)) {
		timeOfDay = "evening"
	} else if (/morning|matin/.test(lower)) {
		timeOfDay = "morning"
	} else if (/right now|maintenant|\bnow\b/.test(lower)) {
		timeOfDay = "now"
	}
	const fromHere = /\b(my location|from here|from my location|ici)\b/.test(lower)
	return {
		intent,
		fromText: fromHere ? "my location" : null,
		toText: place?.label ?? null,
		mode,
		timeOfDay,
		activity: /run|jog|courir|course/.test(lower) ? "run" : null,
		mentionedSensitivities: mentioned,
		language,
	}
}

function looksFrench (message: string): boolean {
	return /[àâçéèêëîïôùûüœ]|\b(je|vais|velo|vélo|marche|pour|avec|ou|où)\b/i.test(
		message,
	)
}

function clarifyQuestion (parsed: ParsedTrip): string {
	const needPlace = !parsed.toText
	const needMode = !parsed.mode
	if (parsed.language === "fr") {
		if (needPlace && needMode) {
			return "Vers où, et est-ce à pied ou à vélo ?"
		}
		if (needPlace) {
			return "Vers où dois-je vous guider ?"
		}
		return "Est-ce à pied ou à vélo ?"
	}
	if (needPlace && needMode) {
		return "Where would you like to go, and will you walk or bike?"
	}
	if (needPlace) {
		return "Where should I route you?"
	}
	return "Will you walk or bike?"
}

function templateExplanation (language: AssistantLanguage, tradeoff: string): string {
	if (language === "fr") {
		return `Le trajet à l'air plus propre : ${tradeoff}. Il évite les rues les plus passantes.`
	}
	return `The cleaner route is ${tradeoff}. It stays off the busiest roads.`
}

function templateConditionsAnswer (
	language: AssistantLanguage,
	intent: "conditions" | "places",
): string {
	if (intent === "places") {
		return language === "fr"
			? "Avec l'air et la chaleur en ce moment, cherchez un endroit à l'intérieur, à l'ombre ou près de l'eau, plutôt qu'un effort intense dehors."
			: "With the air and heat right now, look for somewhere indoors, in the shade, or near water, instead of a hard workout outside."
	}
	return language === "fr"
		? "L'air est dans la zone de risque modéré et il fait chaud, avec de l'ozone. Si vous avez de l'asthme, réduisez l'effort intense ou reportez-le aux heures plus fraîches."
		: "The air is in the moderate range and it feels hot, with ozone around. If you have asthma, ease off strenuous exercise or go when it is cooler."
}

function medicalNote (language: AssistantLanguage): string {
	if (language === "fr") {
		return "Ceci n'est pas un avis médical. Suivez les consignes de votre médecin. Appelez Info-Santé au 811, ou le 911 si les symptômes sont graves."
	}
	return "This is not medical advice. Follow your doctor's instructions. Call Info-Santé at 811, or 911 if symptoms are severe."
}

async function completeJson<T> (
	schema: z.ZodType<T>,
	system: string,
	user: string,
): Promise<T | null> {
	const key = process.env.GROQ_API_KEY
	if (!key) {
		return null
	}
	const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b"
	const client = new OpenAI({
		apiKey: key,
		baseURL: "https://api.groq.com/openai/v1",
	})
	let nudge = ""
	for (let attempt = 0; attempt < 2; attempt += 1) {
		try {
			const extra = model.startsWith("openai/gpt-oss")
				? { reasoning_effort: "low" as const }
				: {}
			const response = await client.chat.completions.create({
				model,
				response_format: { type: "json_object" },
				messages: [
					{ role: "system", content: system },
					{ role: "user", content: user + nudge },
				],
				...extra,
			})
			const text = response.choices[0]?.message?.content ?? ""
			const parsed = schema.safeParse(JSON.parse(text))
			if (parsed.success) {
				return parsed.data
			}
			nudge =
				"\n\nReply with JSON only, matching the requested shape."
		} catch (error) {
			const status = (error as { status?: number }).status
			if (status === 429 || attempt === 1) {
				return null
			}
			nudge = "\n\nReply with JSON only, matching the requested shape."
		}
	}
	return null
}
