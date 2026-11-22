// Picks the health guidance snippets that match the current conditions
// and the user. Deterministic tag matching, no embeddings needed.

import snippets from "@/data/health-guidance.json"
import type { AirCategory } from "@/lib/types"

export type AirLevel = AirCategory

/** Named condition used to match guidance snippets. */
export type GuidanceSensitivity = "asthma" | "copd" | "heat" | "none"

export interface Snippet {
	id: string
	requires: string[]
	boosts: string[]
	alwaysIf?: string[]
	text: string
	source: string
	url: string
}

export interface ConditionsForTags {
	airLevel: AirLevel
	aqhiCategory?: "low" | "moderate" | "high" | "very-high"
	mainPollutant?: "o3" | "pm25" | "no2" | null
	heatWarning: boolean
	feelsLikeC?: number | null
}

/**
 * Turn conditions, sensitivities, and the question into match tags.
 */
export function buildTags (
	conditions: ConditionsForTags,
	sensitivities: GuidanceSensitivity[],
	question: string,
	topic?: "routes" | "places" | "forecast",
): string[] {
	const tags: string[] = []
	if (conditions.airLevel !== "unknown") {
		tags.push(`air:${conditions.airLevel}`)
	}
	if (conditions.aqhiCategory) {
		tags.push(`aqhi:${conditions.aqhiCategory}`)
	}
	if (conditions.mainPollutant) {
		tags.push(`pollutant:${conditions.mainPollutant}`)
	}
	if (conditions.heatWarning) {
		tags.push("heat:warning", "heat:hot")
	} else if ((conditions.feelsLikeC ?? 0) >= 30) {
		tags.push("heat:hot")
	}

	for (const sensitivity of sensitivities) {
		if (sensitivity !== "none") {
			tags.push(`sensitivity:${sensitivity}`)
		}
	}

	const asked = question.toLowerCase()
	if (
		/\b(run|jog|exercise|workout|sport|train|courir|course|entraînement|vélo|bike|cycling)\b/.test(
			asked,
		)
	) {
		tags.push("activity:exercise")
	}
	if (
		/\b(walk|park|outside|outdoor|picnic|marcher|parc|dehors)\b/.test(
			asked,
		)
	) {
		tags.push("activity:outdoor")
	}
	if (/\b(work|school|commute|travail|école)\b/.test(asked)) {
		tags.push("activity:commute")
	}
	if (topic) {
		tags.push(`topic:${topic}`)
	}

	return tags
}

/**
 * Return the best matching snippets, forced matches first.
 */
export function selectGuidance (tags: string[], max = 5): Snippet[] {
	const set = new Set(tags)
	const all = snippets as Snippet[]

	const forced = all.filter((snippet) =>
		snippet.alwaysIf?.some((tag) => set.has(tag)),
	)
	const scored = all
		.filter((snippet) => !forced.includes(snippet))
		.filter((snippet) => snippet.requires.every((tag) => set.has(tag)))
		.map((snippet) => ({
			snippet,
			score: snippet.boosts.filter((tag) => set.has(tag)).length,
		}))
		.filter(({ snippet, score }) => snippet.requires.length > 0 || score > 0)
		.sort((a, b) => b.score - a.score)
		.map(({ snippet }) => snippet)

	return [...forced, ...scored].slice(0, max)
}
