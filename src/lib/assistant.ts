import OpenAI from "openai"
import { z } from "zod"
import type { Place, RoutesResponse, Sensitivity } from "@/lib/types"
import {
	SAMPLE_PLACES,
	searchPlaces,
	type SamplePlace,
} from "@/lib/sample-trip"

const MONTREAL_POINT: Place = {
	label: "Montréal",
	lat: 45.50884,
	lon: -73.58781,
}
import { buildTags, selectGuidance, type GuidanceSensitivity, type Snippet } from "@/lib/guidance"
import { readLiveConditions } from "@/lib/read-live"
import { buildLive, skyFromCode, toSnapshot, type LiveConditions, type RawAir } from "@/lib/live-view"
import { readAqhiForecast, readCanadaWeather } from "@/lib/environment-canada"
import { greetingReply } from "@/lib/greeting"
import type {
	AssistantLanguage,
	AssistantReply,
	AssistantRequestBody,
	AssistantTrip,
	ConditionsSnapshot,
	GuidanceSource,
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

const answerSchema = z.object({
	answer: z.string().min(1),
	usedSnippetIds: z.array(z.string()).optional(),
})

const CACHE_MS = 3 * 60 * 1000
const replyCache = new Map<string, { at: number; reply: AssistantReply }>()

export const aiStats = {
	requests: 0,
	groqCalls: 0,
	cacheHits: 0,
	rateLimits: 0,
	failures: 0,
}

export class AssistantUnavailable extends Error {
	status: 429 | 503

	constructor (status: 429 | 503, message: string) {
		super(message)
		this.status = status
	}
}

interface CallBudget {
	left: number
}

/**
 * Answer one assistant turn. Code gathers the facts; Groq only writes
 * from those facts and the selected guidance snippets.
 */
export async function handleAssistant (
	body: AssistantRequestBody,
): Promise<AssistantReply> {
	aiStats.requests += 1
	const message = body.message.trim()
	const greeting = greetingReply(message)
	if (greeting) {
		const language = /[àâçéèêëîïôùûüœ]|\b(bonjour|salut|bonsoir|merci|allô|allo)\b/i.test(message)
			? "fr"
			: "en"
		const reply: AssistantReply = {
			kind: "clarify",
			language,
			question: greeting,
			parsed: body.prior ?? {
				intent: "unclear",
				fromText: null,
				toText: null,
				mode: null,
				timeOfDay: null,
				activity: null,
				mentionedSensitivities: [],
				language,
			},
			sources: [],
			note: "",
		}
		replyCache.set(cacheKeyFor(body, message), { at: Date.now(), reply })
		return reply
	}
	const cacheKey = cacheKeyFor(body, message)
	const cached = replyCache.get(cacheKey)
	if (cached && Date.now() - cached.at < CACHE_MS) {
		aiStats.cacheHits += 1
		return cached.reply
	}
	const budget: CallBudget = { left: 2 }
	const fresh = body.parsed ?? (await parseRequest(
		message,
		body.hint ?? null,
		body.history ?? [],
		body.trip ?? null,
		budget,
	))
	const merged = carryForward(
		withKnownPlace(mergePrior(fresh, body.prior ?? null, message), message),
		message,
		body.history ?? [],
		body.prior ?? null,
		body.profile.mode ?? null,
	)
	const hinted = body.hint ?? merged.intent
	let intent = hinted === "unclear" && merged.toText ? "directions" : hinted
	if (intent === "unclear" && body.trip && asksAboutTrip(message)) {
		intent = "conditions"
	}
	const understood = { ...merged, intent }

	if (!process.env.GROQ_API_KEY) {
		throw new AssistantUnavailable(503, "Groq is not configured.")
	}
	let reply: AssistantReply
	if (intent === "directions") {
		reply = await planDirections(message, understood, body, budget)
	} else if (intent === "conditions" || intent === "places") {
		reply = await describeConditions(message, understood, body, intent, budget)
	} else {
		reply = {
			kind: "clarify",
			language: understood.language,
			question: clarifyQuestion(understood),
			parsed: understood,
			sources: [],
			note: "",
		}
	}
	if (replyCache.size > 40) {
		const oldest = replyCache.keys().next().value
		if (oldest) {
			replyCache.delete(oldest)
		}
	}
	replyCache.set(cacheKey, { at: Date.now(), reply })
	return reply
}

async function parseRequest (
	message: string,
	hint: AssistantRequestBody["hint"],
	history: Array<{ role: "user" | "assistant"; text: string }>,
	trip: AssistantTrip | null,
	budget: CallBudget,
): Promise<ParsedTrip> {
	const fallback = carryForward(
		templateParse(message, hint ?? null, trip),
		message,
		history,
		null,
		null,
	)
	const ready = fallback.intent !== "unclear"
		&& (fallback.intent !== "directions" || Boolean(fallback.toText))
	if (ready) {
		return hint ? { ...fallback, intent: hint } : fallback
	}
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
			"Known landmarks: Atwater Market, Jean-Talon Market, Parc La Fontaine,",
			"Old Port, Mount Royal chalet, Downtown.",
			"Correct typos of those landmarks. awater means Atwater Market.",
			"Keep any other street address or place name exactly as written.",
			"intent is directions, conditions, places, or unclear.",
			"A request to bike or walk somewhere is directions.",
			"conditions asks if an activity is okay.",
			"places asks what kind of place to go, not a named venue.",
			"unclear is only for vague requests like 'somewhere nice' with no place.",
			"Keep the destination, origin, and mode from earlier turns unless the user changes them.",
			"If a current trip is included and they ask about this route, why, or whether it is okay, intent is conditions.",
			"fromText is my location when they say from here or from my location.",
			"mode is walk, bike, or null. timeOfDay is morning, afternoon, evening, now, or null.",
			"mentionedSensitivities is any of asthma, copd, heat.",
			"language is fr when the user writes French, otherwise en.",
			"Use null for unknown strings.",
		].join(" "),
		[
			trip
				? `Current trip: ${trip.origin.label} to ${trip.destination.label} by ${trip.mode}.`
				: "",
			transcript ? `${transcript}\nuser: ${message}` : message,
		].filter(Boolean).join("\n"),
		budget,
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
	budget: CallBudget,
): Promise<AssistantReply> {
	const destination = await locatePlace(parsed.toText)
	if (!destination) {
		const named = parsed.toText?.trim()
		const question = named
			? parsed.language === "fr"
				? `Je ne trouve pas « ${named} » à Montréal. Essayez un lieu ou une intersection proche.`
				: `I couldn't find “${named}” in Montréal. Try a landmark or a nearby intersection.`
			: clarifyQuestion(parsed)
		return {
			kind: "clarify",
			language: parsed.language,
			question,
			parsed,
			sources: [],
			note: "",
		}
	}
	const origin = await resolveOrigin(parsed, body.userLocation ?? null)
	if (!origin) {
		return {
			kind: "clarify",
			language: parsed.language,
			question: parsed.language === "fr"
				? "D'où partez-vous ?"
				: "Where are you starting from?",
			parsed,
			sources: [],
			note: "",
		}
	}
	const mode = parsed.mode ?? body.profile.mode ?? body.trip?.mode ?? "walk"
	const gathered = await gatherContext(destination.lat, destination.lon, destination.label)
	const reuse = Boolean(
		body.trip
		&& !modeChanged(mode, body.trip)
		&& sameTarget(destination, body.trip)
		&& sameTarget(origin, body.trip, "origin"),
	)
	const airLevel = gathered.facts.air?.level
	const knownAir = airLevel === "good" || airLevel === "acceptable" || airLevel === "poor"
		? airLevel
		: null
	const routed = reuse && body.trip
		? tripResponse(body.trip)
		: await fetchRoutes(origin, destination, mode, body.profile, knownAir)
	const route = reuse && body.trip
		? tripFacts(body.trip)
		: routeFacts(routed, gathered.poor)
	const snippets = matchedSnippets(message, parsed, body.profile, gathered.snapshot, "routes")
	const caution = cautionNote(parsed.language, gathered.poor, gathered.snapshot.heatWarning)
	const generated = await writeAnswer(
		message,
		parsed,
		body.profile,
		{ ...gathered.facts, route },
		snippets,
		caution,
		budget,
		"Explain the fastest and cleaner routes from the route facts. Use route.tradeoff for the comparison. busyShare is the fraction of distance on busy roads. If route is null, say the street route is unavailable.",
	)
	if (!generated) {
		throw new AssistantUnavailable(503, "The assistant could not write an answer.")
	}
	const sources = replySources(gathered, snippets, generated.usedSnippetIds ?? [])
	const understood = { ...parsed, toText: destination.label, mode }
	if (!routed) {
		return {
			kind: "conditions",
			language: parsed.language,
			parsed: understood,
			answer: generated.answer,
			conditions: gathered.snapshot,
			sources,
			note: caution,
		}
	}
	return {
		kind: "directions",
		language: parsed.language,
		parsed: understood,
		origin,
		destination,
		directions: routed,
		explanation: generated.answer,
		sources,
		note: caution,
	}
}

async function describeConditions (
	message: string,
	parsed: ParsedTrip,
	body: AssistantRequestBody,
	intent: "conditions" | "places",
	budget: CallBudget,
): Promise<AssistantReply> {
	const named = await locatePlace(parsed.toText) ?? await locatePlace(message)
	const point = named ?? body.userLocation ?? MONTREAL_POINT
	const gathered = await gatherContext(point.lat, point.lon, point.label)
	const useTrip = Boolean(
		body.trip
		&& !asksAboutAir(message)
		&& (asksAboutTrip(message) || (named && sameTarget(named, body.trip))),
	)
	const snippets = matchedSnippets(
		message,
		parsed,
		body.profile,
		gathered.snapshot,
		intent === "places" ? "places" : "forecast",
	)
	const caution = cautionNote(parsed.language, gathered.poor, gathered.snapshot.heatWarning)
	const generated = await writeAnswer(
		message,
		parsed,
		body.profile,
		{ ...gathered.facts, route: useTrip && body.trip ? tripFacts(body.trip) : null },
		snippets,
		caution,
		budget,
		intent === "places"
			? "Suggest kinds of places (indoors, shade, near water), not specific venues."
			: asksAboutAir(message)
				? "Answer the air question with the station, index, level, and pollutant. Do not recap the route."
				: "When route is present, use its tradeoff, durations, distances, and busyShare as given. Do not invent another route or recompute a percentage.",
	)
	if (!generated) {
		throw new AssistantUnavailable(503, "The assistant could not write an answer.")
	}
	return {
		kind: "conditions",
		language: parsed.language,
		parsed,
		answer: generated.answer,
		conditions: gathered.snapshot,
		sources: replySources(gathered, snippets, generated.usedSnippetIds ?? []),
		note: caution,
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
			aqhiCategory:
				snapshot.airLevel === "unknown" ? undefined : snapshot.aqhiCategory,
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

async function resolveOrigin (parsed: ParsedTrip, userLocation: Place | null): Promise<Place | null> {
	const from = parsed.fromText?.trim().toLowerCase() ?? ""
	const here =
		from === "" ||
		from === "your location" ||
		from === "my location" ||
		from === "here" ||
		from === "ici" ||
		from === "ma position"
	if (here) {
		return userLocation
	}
	return locatePlace(parsed.fromText)
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

const MODE_ONLY = /^(?:walk|walking|bike|biking|cycling|velo|vélo|marche|a pied|à pied)$/i

function blank (value: string | null | undefined): string | null {
	const text = value?.trim() ?? ""
	return text.length > 0 ? text : null
}

function modeFrom (text: string): "walk" | "bike" | null {
	const lower = text.toLowerCase()
	if (/\b(bike|biking|cycling|velo|vélo)\b/.test(lower)) {
		return "bike"
	}
	if (/\b(walk|walking|marche|à pied|a pied)\b/.test(lower)) {
		return "walk"
	}
	return null
}

/** The place named in this message, including a street address. */
function destinationPhrase (text: string): string | null {
	const trimmed = text.trim()
	if (!trimmed || MODE_ONLY.test(trimmed)) {
		return null
	}
	const lead = trimmed.match(
		/\b(?:going to|go to|get to|head to|route to|take me to|vais à|vais au|vais aux|aller à|aller au)\s+(.+)$/i,
	)
	const tail = lead ?? trimmed.match(/\b(?:vers|à|au|aux|to)\s+(.+)$/i)
	let phrase = tail?.[1]?.trim() ?? ""
	if (!phrase && /\d/.test(trimmed) && /\b(rue|street|ave|avenue|boul|boulevard|chemin|road|st)\b/i.test(trimmed)) {
		phrase = trimmed
	}
	phrase = phrase
		.replace(/\b(on foot|by bike|by foot|walking|biking|this morning|this afternoon|this evening|right now|à pied|a pied|à vélo|a velo|en vélo|en velo)\b/gi, "")
		.replace(/\b(walk|bike)\b/gi, "")
		.replace(/[?.!,]+$/g, "")
		.trim()
	if (phrase.length < 3 || MODE_ONLY.test(phrase)) {
		return null
	}
	return phrase
}

function carryForward (
	parsed: ParsedTrip,
	message: string,
	history: Array<{ role: "user" | "assistant"; text: string }>,
	prior: ParsedTrip | null,
	profileMode: "walk" | "bike" | null,
): ParsedTrip {
	const saidPlace = destinationPhrase(message)
	const numbered = Boolean(saidPlace && /\d/.test(saidPlace))
	const known = findPlace(numbered ? null : saidPlace ?? message)
	let toText = numbered
		? saidPlace
		: known?.label ?? saidPlace ?? blank(parsed.toText) ?? blank(prior?.toText)
	let mode = modeFrom(message) ?? parsed.mode ?? prior?.mode ?? null
	const earlier = [...history].reverse()
	for (const turn of earlier) {
		if (turn.role !== "user" || turn.text === message) {
			continue
		}
		if (!toText) {
			const earlierPlace = destinationPhrase(turn.text)
			const earlierNumbered = Boolean(earlierPlace && /\d/.test(earlierPlace))
			toText = earlierNumbered
				? earlierPlace
				: findPlace(earlierPlace)?.label ?? earlierPlace ?? findPlace(turn.text)?.label ?? null
		}
		mode = mode ?? modeFrom(turn.text)
	}
	const asking = parsed.intent === "conditions" || parsed.intent === "places"
	const intent = asking ? parsed.intent : toText ? "directions" : parsed.intent
	if (intent === "directions" && !mode) {
		mode = profileMode
	}
	return {
		...parsed,
		intent,
		toText: toText ?? null,
		mode,
		fromText: blank(parsed.fromText) ?? blank(prior?.fromText),
	}
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
	trip: AssistantTrip | null,
): ParsedTrip {
	const language = looksFrench(message) ? "fr" : "en"
	const lower = message.toLowerCase()
	const said = destinationPhrase(message)
	const numbered = Boolean(said && /\d/.test(said))
	const place = findPlace(numbered ? null : said ?? message)
	let intent: ParsedTrip["intent"] = hint ?? "unclear"
	if (!hint) {
		if (/\b(where can i go|somewhere to go|ou puis-je|où puis-je|endroit)\b/.test(lower)) {
			intent = "places"
		} else if (asksAboutAir(message) || /\b(is it okay|can i|safe to|puis-je|est-ce que)\b/.test(lower)) {
			intent = "conditions"
		} else if (place || said) {
			intent = "directions"
		} else if (trip && asksAboutTrip(message)) {
			intent = "conditions"
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
		toText: numbered ? said : place?.label ?? said ?? (intent === "conditions" && trip ? trip.destination.label : null),
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

const FACT_RULES = [
	"You write one short answer for a Montréal clean-air assistant.",
	"Use only the facts object and the guidance snippets.",
	"A null field is unavailable. Say that it is unavailable.",
	"Do not invent numbers, times, streets, shade, or health claims.",
	"shadiest and shadeShare are null because shade is not measured.",
	"mainStreets null means the street list was not calculated.",
	"Do not give medical advice. If caution is non-empty, include that sentence.",
	"JSON shape: { \"answer\": string, \"usedSnippetIds\": string[] }.",
].join(" ")

interface Gathered {
	poor: boolean
	snapshot: ConditionsSnapshot
	facts: {
		air: {
			station: string
			observedAt: string | null
			aqi: number
			level: string
			mainPollutant: string | null
			trend: null
		} | null
		weather: {
			temperatureC: number | null
			feelsLikeC: number | null
			conditions: string | null
			wind: string | null
			source: "Environment Canada" | "Open-Meteo"
		} | null
		alerts: string[] | null
		aqhiForecast: Array<{ time: string; aqhi: number }> | null
	}
}

function cacheKeyFor (body: AssistantRequestBody, message: string): string {
	const loc = body.userLocation
	const place = loc ? `${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}` : ""
	const trip = body.trip
		? `${body.trip.origin.label}->${body.trip.destination.label}:${body.trip.mode}:${body.trip.strictMode}`
		: ""
	const profile = [
		body.profile.asthma,
		body.profile.copd,
		body.profile.heat,
		body.profile.mode ?? "",
	].join("/")
	const memory = [
		body.prior?.toText ?? "",
		body.prior?.mode ?? "",
		...(body.history ?? []).filter((turn) => turn.role === "user").map((turn) => turn.text),
	].join("~")
	return [message.toLowerCase(), profile, place, trip, body.hint ?? "", memory].join("|")
}

function asksAboutTrip (message: string): boolean {
	return /\b(this route|that route|the route|why this|cet itin[eé]raire|pourquoi)\b/i.test(message)
		|| /\b(okay|ok)\b/i.test(message) && /\b(route|asthma|asthme)\b/i.test(message)
}

function asksAboutAir (message: string): boolean {
	return /\b(air|aqi|iqa|pollution|pollutant|smog|ozone|pm2\.?5)\b/i.test(message)
		|| /\b(how'?s|how is|what'?s|what is)\b/.test(message.toLowerCase())
			&& /\b(there|air|quality)\b/.test(message.toLowerCase())
}

async function gatherContext (lat: number, lon: number, label: string): Promise<Gathered> {
	const settled = await Promise.allSettled([
		readNearestAir(lat, lon),
		readCanadaWeather(),
		readAqhiForecast(),
		readOpenMeteoNow(lat, lon),
	])
	let live = settled[0].status === "fulfilled" ? settled[0].value : null
	if (!live) {
		try {
			live = await readLiveConditions(lat, lon)
		} catch {
			live = null
		}
	}
	const canada = settled[1].status === "fulfilled" ? settled[1].value : null
	const aqhi = settled[2].status === "fulfilled" ? settled[2].value : null
	const meteo = settled[3].status === "fulfilled" ? settled[3].value : null
	const heatAlert = Boolean(canada?.alerts.some((alert) => /heat|chaleur|humidex/i.test(alert)))
	const snapshot = live ? toSnapshot(live, label) : unknownSnapshot(label)
	const weather = weatherFacts(canada, meteo)
	snapshot.heatWarning = heatAlert
	if (weather?.feelsLikeC != null) {
		snapshot.feelsLikeC = Math.round(weather.feelsLikeC)
	}
	const air = airFacts(live)
	return {
		poor: air?.level === "poor",
		snapshot,
		facts: {
			air,
			weather,
			alerts: canada ? canada.alerts : null,
			aqhiForecast: aqhi,
		},
	}
}

function airFacts (live: LiveConditions | null): Gathered["facts"]["air"] {
	if (!live || live.index == null || live.level === "unknown") {
		return null
	}
	return {
		station: live.stationName,
		observedAt: live.observedLabel || null,
		aqi: live.index,
		level: live.level,
		mainPollutant: live.pollutant === "—" ? null : live.pollutant,
		trend: null,
	}
}

interface NowWeather {
	tempC: number | null
	feelsC: number | null
	sky: string
	windKmh: number | null
}

async function readNearestAir (lat: number, lon: number): Promise<LiveConditions | null> {
	const base = process.env.BACKEND_URL ?? "http://127.0.0.1:8000"
	try {
		const response = await fetch(
			`${base}/api/air?lat=${lat}&lon=${lon}`,
			{ cache: "no-store", signal: AbortSignal.timeout(2500) },
		)
		if (!response.ok) {
			return null
		}
		const body = await response.json() as {
			station_name?: string
			neighbourhood?: string
			iqa?: number | null
			level?: RawAir["level"]
			pollutant?: string | null
			observed_at?: string | null
		}
		const air: RawAir = {
			stationName: body.station_name ?? "Montréal",
			neighbourhood: body.neighbourhood ?? "",
			iqa: typeof body.iqa === "number" ? body.iqa : null,
			level: body.level ?? "unknown",
			pollutant: body.pollutant ?? null,
			observedAt: body.observed_at ?? null,
		}
		return buildLive(air, null)
	} catch {
		return null
	}
}

async function readOpenMeteoNow (lat: number, lon: number): Promise<NowWeather | null> {
	const params = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
		timezone: "America/Toronto",
	})
	try {
		const response = await fetch(
			`https://api.open-meteo.com/v1/forecast?${params.toString()}`,
			{ cache: "no-store", signal: AbortSignal.timeout(3000) },
		)
		if (!response.ok) {
			return null
		}
		const data = await response.json() as { current?: Record<string, number | null> }
		const current = data.current
		if (!current) {
			return null
		}
		const code = typeof current.weather_code === "number" ? current.weather_code : null
		return {
			tempC: typeof current.temperature_2m === "number" ? current.temperature_2m : null,
			feelsC: typeof current.apparent_temperature === "number" ? current.apparent_temperature : null,
			sky: skyFromCode(code),
			windKmh: typeof current.wind_speed_10m === "number" ? current.wind_speed_10m : null,
		}
	} catch {
		return null
	}
}

function weatherFacts (
	canada: Awaited<ReturnType<typeof readCanadaWeather>>,
	meteo: NowWeather | null,
): Gathered["facts"]["weather"] {
	if (canada && canada.temperatureC != null) {
		return {
			temperatureC: canada.temperatureC,
			feelsLikeC: canada.feelsLikeC ?? meteo?.feelsC ?? null,
			conditions: canada.conditions,
			wind: canada.wind,
			source: "Environment Canada",
		}
	}
	if (meteo && meteo.tempC != null) {
		return {
			temperatureC: meteo.tempC,
			feelsLikeC: meteo.feelsC,
			conditions: meteo.sky === "—" ? null : meteo.sky,
			wind: meteo.windKmh == null ? null : `${meteo.windKmh} km/h`,
			source: "Open-Meteo",
		}
	}
	return null
}

function unknownSnapshot (label: string): ConditionsSnapshot {
	return {
		placeLabel: label,
		airLevel: "unknown",
		aqi: 0,
		levelLabel: "Unknown",
		mainPollutant: null,
		feelsLikeC: 0,
		heatWarning: false,
		aqhiCategory: "low",
	}
}

function tripFacts (trip: AssistantTrip) {
	return {
		tradeoff: trip.tradeoff,
		strictMode: trip.strictMode,
		fastest: trip.routes.find((route) => route.id === "fast") ?? null,
		clean: trip.routes.find((route) => route.id === "clean") ?? null,
		shadiest: null,
	}
}

function routeFacts (routed: RoutesResponse | null, strictMode: boolean) {
	if (!routed) {
		return null
	}
	const pick = (id: "fast" | "clean") => {
		const route = routed.routes.find((item) => item.id === id)
		if (!route) {
			return null
		}
		return {
			label: route.label,
			durationSeconds: route.duration_seconds,
			distanceMeters: route.distance_meters,
			busyShare: route.busy_share,
			mainStreets: null,
			shadeShare: null,
		}
	}
	return {
		tradeoff: routed.tradeoff,
		strictMode,
		fastest: pick("fast"),
		clean: pick("clean"),
		shadiest: null,
	}
}

function tripResponse (trip: AssistantTrip): RoutesResponse {
	return {
		tradeoff: trip.tradeoff,
		suggest_metro: trip.strictMode,
		routes: trip.routes.map((route) => ({
			id: route.id,
			label: route.label,
			duration_seconds: route.durationSeconds,
			distance_meters: route.distanceMeters,
			busy_time_seconds: Math.round(route.durationSeconds * route.busyShare),
			busy_share: route.busyShare,
			trip_co2_g: 0,
			driving_co2_g: 0,
			geometry: { type: "LineString" as const, coordinates: [] },
			explanations: [],
		})),
	}
}

async function fetchRoutes (
	origin: Place,
	destination: Place,
	mode: "walk" | "bike",
	profile: SavedProfile,
	airLevel: "good" | "acceptable" | "poor" | null,
): Promise<RoutesResponse | null> {
	const level = (value: Sensitivity | null | undefined): Sensitivity =>
		value === "high" || value === "medium" || value === "low" ? value : "low"
	const backend = process.env.BACKEND_URL || "http://127.0.0.1:8000"
	try {
		const response = await fetch(`${backend}/api/route`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			signal: AbortSignal.timeout(5000),
			body: JSON.stringify({
				origin,
				destination,
				profile: {
					asthma: level(profile.asthma),
					copd: level(profile.copd),
					heat: level(profile.heat),
					mode,
				},
				poor_air: airLevel === "poor",
				...(airLevel ? { air_level: airLevel } : {}),
			}),
		})
		if (!response.ok) {
			return null
		}
		return await response.json() as RoutesResponse
	} catch {
		return null
	}
}

async function locatePlace (text: string | null): Promise<Place | null> {
	const query = text?.trim() ?? ""
	const looksLikeAddress = /\d/.test(query)
	const sample = looksLikeAddress ? null : findPlace(text)
	if (sample) {
		return { label: sample.label, lat: sample.lat, lon: sample.lon }
	}
	if (query.length < 3 || /^(my location|your location|here|ici|ma position)$/i.test(query)) {
		return null
	}
	const params = new URLSearchParams({
		q: query,
		lat: "45.50",
		lon: "-73.57",
		bbox: "-73.98,45.40,-73.47,45.71",
		limit: "1",
		lang: "en",
	})
	try {
		const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
			signal: AbortSignal.timeout(4000),
		})
		if (!response.ok) {
			return null
		}
		const data = await response.json() as {
			features?: Array<{
				geometry?: { coordinates?: [number, number] }
				properties?: {
					name?: string
					street?: string
					housenumber?: string
				}
			}>
		}
		const feature = data.features?.[0]
		const coords = feature?.geometry?.coordinates
		const props = feature?.properties
		const street = [props?.housenumber, props?.street].filter(Boolean).join(" ")
		const name = props?.name?.trim() ?? ""
		const label = name && street && !name.toLowerCase().includes(street.toLowerCase())
			? `${name}, ${street}`
			: name || street
		if (!label || !coords) {
			return null
		}
		return { label, lat: coords[1], lon: coords[0] }
	} catch {
		return null
	}
}

function sameTarget (
	place: Place,
	trip: AssistantTrip,
	which: "origin" | "destination" = "destination",
): boolean {
	const other = which === "origin" ? trip.origin : trip.destination
	if (normalizePlace(place.label) === normalizePlace(other.label)) {
		return true
	}
	return Math.abs(place.lat - other.lat) < 0.002 && Math.abs(place.lon - other.lon) < 0.002
}

function modeChanged (mode: "walk" | "bike", trip: AssistantTrip): boolean {
	return mode !== trip.mode
}

function cautionNote (language: AssistantLanguage, poor: boolean, heat: boolean): string {
	if (!poor && !heat) {
		return ""
	}
	if (language === "fr") {
		return "Appelez Info-Santé au 811, ou le 911 si les symptômes sont graves."
	}
	return "Call Info-Santé at 811, or 911 if symptoms are severe."
}

async function writeAnswer (
	message: string,
	parsed: ParsedTrip,
	profile: SavedProfile,
	facts: Gathered["facts"] & {
		route: ReturnType<typeof tripFacts> | ReturnType<typeof routeFacts>
	},
	snippets: Snippet[],
	caution: string,
	budget: CallBudget,
	extra: string,
) {
	return completeJson(
		answerSchema,
		[
			FACT_RULES,
			extra,
			parsed.language === "fr" ? "Write the answer in French." : "Write the answer in English.",
		].join(" "),
		JSON.stringify({
			question: message,
			profile,
			facts,
			caution: caution || null,
			snippets: snippets.map((snippet) => ({ id: snippet.id, text: snippet.text })),
		}),
		budget,
	)
}

function replySources (
	gathered: Gathered,
	snippets: Snippet[],
	usedIds: string[],
): GuidanceSource[] {
	const sources: GuidanceSource[] = [
		{
			id: "rsqa",
			source: "RSQA",
			url: "https://www.quebec.ca/sante/conseils-et-prevention/sante-et-environnement/qualite-de-lair",
			detail: gathered.facts.air
				? `${gathered.facts.air.station}${gathered.facts.air.observedAt ? `, ${gathered.facts.air.observedAt}` : ""}`
				: "Live reading unavailable",
		},
		{
			id: "ec-weather",
			source: "Environment Canada",
			url: "https://weather.gc.ca/",
			detail: gathered.facts.weather?.source === "Environment Canada"
				? (gathered.facts.alerts?.length
					? gathered.facts.alerts.join("; ")
					: "City page weather, no active alert")
				: "City page weather unavailable",
		},
		{
			id: "ec-aqhi",
			source: "Environment Canada",
			url: "https://weather.gc.ca/airquality/pages/index_e.html",
			detail: gathered.facts.aqhiForecast
				? "AQHI forecast"
				: "AQHI forecast is not published for a Montréal station",
		},
	]
	if (gathered.facts.weather?.source === "Open-Meteo") {
		sources.push({
			id: "open-meteo",
			source: "Open-Meteo",
			url: "https://open-meteo.com/",
			detail: "Backup weather",
		})
	}
	const used = new Set(usedIds)
	const chosen = snippets.filter((snippet) => used.has(snippet.id))
	const cited = chosen.length > 0 ? chosen : snippets
	for (const snippet of cited) {
		sources.push({ id: snippet.id, source: snippet.source, url: snippet.url })
	}
	return sources
}

async function completeJson<T> (
	schema: z.ZodType<T>,
	system: string,
	user: string,
	budget: CallBudget,
): Promise<T | null> {
	const key = process.env.GROQ_API_KEY
	if (!key || budget.left <= 0) {
		return null
	}
	const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b"
	const client = new OpenAI({
		apiKey: key,
		baseURL: "https://api.groq.com/openai/v1",
		timeout: 5000,
	})
	let nudge = ""
	while (budget.left > 0) {
		budget.left -= 1
		aiStats.groqCalls += 1
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
			nudge = "\n\nReply with JSON only, matching the requested shape."
		} catch (error) {
			if (error instanceof SyntaxError) {
				nudge = "\n\nReply with JSON only, matching the requested shape."
				continue
			}
			const status = (error as { status?: number }).status
			if (status === 429) {
				aiStats.rateLimits += 1
				throw new AssistantUnavailable(429, "Groq is rate-limited.")
			}
			aiStats.failures += 1
			return null
		}
	}
	aiStats.failures += 1
	return null
}
