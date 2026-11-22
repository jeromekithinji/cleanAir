import type { Sensitivity } from "@/lib/types"
import type { SavedProfile } from "@/lib/assistant-types"

const PROFILE_KEY = "clean-air-profile"

function isLevel (value: unknown): value is Sensitivity {
	return value === "low" || value === "medium" || value === "high"
}

/** Read the health rankings saved in this browser. */
export function readProfile (): SavedProfile | null {
	if (typeof window === "undefined") {
		return null
	}
	try {
		const raw = window.localStorage.getItem(PROFILE_KEY)
		if (!raw) {
			return null
		}
		const parsed = JSON.parse(raw) as Partial<SavedProfile>
		return {
			asthma: isLevel(parsed.asthma) ? parsed.asthma : null,
			copd: isLevel(parsed.copd) ? parsed.copd : null,
			heat: isLevel(parsed.heat) ? parsed.heat : null,
		}
	} catch {
		return null
	}
}

/** Save asthma, COPD, and heat rankings for later messages. */
export function writeProfile (profile: SavedProfile) {
	window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}
