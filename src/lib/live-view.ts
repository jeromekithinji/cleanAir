import type { Scenario } from "@/data/mock"
import type { AirCategory, WeatherRow } from "@/lib/types"
import type { ConditionsSnapshot } from "@/lib/assistant-types"

export interface RawAir {
	stationName: string
	neighbourhood: string
	iqa: number | null
	level: AirCategory
	pollutant: string | null
	observedAt: string | null
}

export interface RawWeather {
	source: "stored" | "live" | "unavailable"
	stationName: string | null
	current: WeatherRow | null
	hourly: WeatherRow[]
	daily: WeatherRow[]
}

export interface LiveConditions {
	status: "ready" | "partial" | "unavailable"
	stationName: string
	neighbourhood: string
	observedLabel: string
	weatherUpdatedLabel: string
	index: number | null
	level: AirCategory
	pollutant: string
	pollutantCode: "o3" | "pm25" | "no2" | null
	tempC: number | null
	feelsC: number | null
	sky: string
	windKmh: number | null
	rainChance: number | null
	bestTime: string
	heatWarning: boolean
	weatherSource: "stored" | "live" | "unavailable"
}

const MONTREAL = "Montréal"

export function buildLive (air: RawAir | null, weather: RawWeather | null): LiveConditions {
	const current = weather?.current ?? weather?.hourly[0] ?? null
	const tempC = num(current?.temperature_2m)
	const feelsC = num(current?.apparent_temperature) ?? tempC
	const index = air?.iqa ?? null
	const level = air?.level ?? "unknown"
	const hasAir = index !== null && level !== "unknown"
	const hasWeather = tempC !== null
	const daily = weather?.daily[0] ?? null
	return {
		status: hasAir && hasWeather ? "ready" : hasAir || hasWeather ? "partial" : "unavailable",
		stationName: air?.stationName || weather?.stationName || MONTREAL,
		neighbourhood: air?.neighbourhood ?? "",
		observedLabel: air?.observedAt ? formatClock(air.observedAt) : "",
		weatherUpdatedLabel: typeof current?.time === "string" ? formatClock(current.time) : "",
		index,
		level,
		pollutant: air?.pollutant?.trim() || "—",
		pollutantCode: pollutantCode(air?.pollutant),
		tempC,
		feelsC,
		sky: skyFromCode(num(current?.weather_code)),
		windKmh: num(current?.wind_speed_10m),
		rainChance: num(current?.precipitation_probability),
		bestTime: bestTime(weather?.hourly ?? []),
		heatWarning: heatWarning(feelsC, daily),
		weatherSource: weather?.source ?? "unavailable",
	}
}

export function toSnapshot (live: LiveConditions, fallbackLabel: string): ConditionsSnapshot {
	const levelLabel =
		live.level === "good"
			? "Good"
			: live.level === "acceptable"
				? "Acceptable"
				: live.level === "poor"
					? "Poor"
					: "Unknown"
	return {
		placeLabel: live.stationName || fallbackLabel,
		airLevel: live.level,
		aqi: live.index ?? 0,
		levelLabel,
		mainPollutant: live.pollutantCode,
		feelsLikeC: Math.round(live.feelsC ?? live.tempC ?? 0),
		heatWarning: live.heatWarning,
		aqhiCategory: aqhiCategory(live.level, live.index),
	}
}

export function toScenario (live: LiveConditions): Scenario {
	return {
		id: 0,
		index: live.index ?? 0,
		pollutant: live.pollutant,
		previous: live.index ?? 0,
		temp: live.tempC == null ? 0 : Math.round(live.tempC),
		feels: live.feelsC == null ? 0 : Math.round(live.feelsC),
		sky: live.sky,
		wind: live.windKmh == null ? 0 : Math.round(live.windKmh),
		best: live.bestTime,
		heatWarning: live.heatWarning,
		stationName: live.stationName,
	}
}

export function pollutantCode (name: string | null | undefined): "o3" | "pm25" | "no2" | null {
	const compact = (name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")
	if (compact.includes("pm25")) {
		return "pm25"
	}
	if (compact === "o3" || compact.includes("ozone")) {
		return "o3"
	}
	if (compact.includes("no2")) {
		return "no2"
	}
	return null
}

function aqhiCategory (level: AirCategory, iqa: number | null): ConditionsSnapshot["aqhiCategory"] {
	if (level === "acceptable") {
		return "moderate"
	}
	if (level === "poor") {
		return (iqa ?? 0) >= 100 ? "very-high" : "high"
	}
	return "low"
}

function num (value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null
}

export function skyFromCode (code: number | null): string {
	if (code == null) {
		return "—"
	}
	if (code === 0) {
		return "Clear"
	}
	if (code <= 2) {
		return "Mainly clear"
	}
	if (code === 3) {
		return "Overcast"
	}
	if (code === 45 || code === 48) {
		return "Fog"
	}
	if (code >= 51 && code <= 67) {
		return "Rain"
	}
	if (code >= 71 && code <= 77) {
		return "Snow"
	}
	if (code >= 80 && code <= 82) {
		return "Showers"
	}
	if (code >= 85 && code <= 86) {
		return "Snow showers"
	}
	if (code >= 95) {
		return "Thunderstorm"
	}
	return "Cloudy"
}

function heatWarning (feelsC: number | null, daily: WeatherRow | null): boolean {
	const apparentMax = num(daily?.apparent_temperature_max)
	const tempMax = num(daily?.temperature_2m_max)
	const tempMin = num(daily?.temperature_2m_min)
	if ((feelsC ?? 0) >= 40 || (apparentMax ?? 0) >= 40) {
		return true
	}
	return (tempMax ?? 0) >= 30 && (tempMin ?? 0) >= 18
}

function bestTime (hourly: WeatherRow[]): string {
	const upcoming = hourly.slice(0, 18)
	if (upcoming.length === 0) {
		return "—"
	}
	let best = upcoming[0]
	let bestScore = Number.POSITIVE_INFINITY
	for (const row of upcoming) {
		const feels = num(row.apparent_temperature) ?? num(row.temperature_2m) ?? 10
		const rain = num(row.precipitation_probability) ?? 0
		const score = rain * 2 + Math.abs(feels - 18)
		if (score < bestScore) {
			best = row
			bestScore = score
		}
	}
	const time = best?.time
	return typeof time === "string" ? formatWhen(time) : "—"
}

function formatClock (iso: string): string {
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) {
		return ""
	}
	return new Intl.DateTimeFormat("en-US", {
		timeZone: "America/Toronto",
		hour: "numeric",
		minute: "2-digit",
	}).format(date)
}

function formatWhen (iso: string): string {
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) {
		return "—"
	}
	const day = new Intl.DateTimeFormat("en-CA", {
		timeZone: "America/Toronto",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	})
	const time = formatClock(iso)
	if (day.format(date) === day.format(new Date())) {
		return `Today ${time}`
	}
	return `Tomorrow ${time}`
}
