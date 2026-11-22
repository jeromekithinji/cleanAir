import { readFile } from "node:fs/promises"
import path from "node:path"
import type { Place, WeatherRow } from "@/lib/types"
import type { ConditionsSnapshot } from "@/lib/assistant-types"
import {
	buildLive,
	toSnapshot,
	type LiveConditions,
	type RawAir,
	type RawWeather,
} from "@/lib/live-view"

const MAX_STATION_KM = 20
const MONTREAL = { lat: 45.50884, lon: -73.58781 }

interface AirStation {
	name: string
	neighbourhood: string
	latitude: number
	longitude: number
	reading: {
		iqa: number
		level: RawAir["level"]
		pollutant: string | null
		observed_at: string
	} | null
}

interface WeatherStation {
	name: string
	latitude: number
	longitude: number
	hourly: WeatherRow[]
	daily: WeatherRow[]
}

export async function readLiveConditions (lat: number, lon: number): Promise<LiveConditions> {
	const fromApi = await readFromApi(lat, lon)
	if (fromApi) {
		return fromApi
	}
	const air = await readAirFile(lat, lon)
	const weather = await readWeather(lat, lon)
	return buildLive(air, weather)
}

export async function readSnapshot (place: Place): Promise<ConditionsSnapshot> {
	try {
		const live = await readLiveConditions(place.lat, place.lon)
		return toSnapshot(live, place.label)
	} catch {
		return {
			placeLabel: place.label,
			airLevel: "unknown",
			aqi: 0,
			levelLabel: "Unknown",
			mainPollutant: null,
			feelsLikeC: 0,
			heatWarning: false,
			aqhiCategory: "low",
		}
	}
}

export function montrealPoint (): { lat: number; lon: number } {
	return MONTREAL
}

async function readFromApi (lat: number, lon: number): Promise<LiveConditions | null> {
	const base = process.env.BACKEND_URL ?? "http://127.0.0.1:8000"
	try {
		const airRes = await fetch(
			`${base}/api/air?lat=${lat}&lon=${lon}`,
			{ cache: "no-store", signal: AbortSignal.timeout(2500) },
		)
		if (!airRes.ok) {
			return null
		}
		const airBody = (await airRes.json()) as {
			station_name?: string
			neighbourhood?: string
			iqa?: number | null
			level?: RawAir["level"]
			pollutant?: string | null
			observed_at?: string | null
		}
		const air: RawAir = {
			stationName: airBody.station_name ?? "Montréal",
			neighbourhood: airBody.neighbourhood ?? "",
			iqa: typeof airBody.iqa === "number" ? airBody.iqa : null,
			level: airBody.level ?? "unknown",
			pollutant: airBody.pollutant ?? null,
			observedAt: airBody.observed_at ?? null,
		}
		const weatherRes = await fetch(
			`${base}/conditions?lat=${lat}&lon=${lon}`,
			{ cache: "no-store", signal: AbortSignal.timeout(8000) },
		)
		if (!weatherRes.ok) {
			return buildLive(air, await readWeather(lat, lon))
		}
		const weatherBody = (await weatherRes.json()) as RawWeather & {
			station_name?: string | null
			source?: RawWeather["source"]
		}
		const weather: RawWeather = {
			source: weatherBody.source ?? "unavailable",
			stationName: weatherBody.station_name ?? null,
			current: weatherBody.current ?? null,
			hourly: weatherBody.hourly ?? [],
			daily: weatherBody.daily ?? [],
		}
		if (!weather.current && weather.hourly.length === 0) {
			return buildLive(air, await readWeather(lat, lon))
		}
		return buildLive(air, weather)
	} catch {
		return null
	}
}

async function readAirFile (lat: number, lon: number): Promise<RawAir | null> {
	const file = await readJson<{ stations: AirStation[] }>("air.json")
	const station = closest(
		file?.stations.filter((item) => item.reading) ?? [],
		lat,
		lon,
	)
	if (!station?.reading) {
		return null
	}
	return {
		stationName: station.name,
		neighbourhood: station.neighbourhood,
		iqa: station.reading.iqa,
		level: station.reading.level,
		pollutant: station.reading.pollutant,
		observedAt: station.reading.observed_at,
	}
}

async function readWeather (lat: number, lon: number): Promise<RawWeather> {
	const stored = await readStoredWeather(lat, lon)
	if (stored && hasThisHour(stored.hourly)) {
		return stored
	}
	const live = await fetchOpenMeteo(lat, lon)
	return live ?? stored ?? { source: "unavailable", stationName: null, current: null, hourly: [], daily: [] }
}

async function readStoredWeather (lat: number, lon: number): Promise<RawWeather | null> {
	const file = await readJson<{ stations: WeatherStation[] }>("weather.json")
	const nearestStation = closest(file?.stations ?? [], lat, lon)
	if (!nearestStation) {
		return null
	}
	const hourly = fromThisHour(nearestStation.hourly)
	return {
		source: "stored",
		stationName: nearestStation.name,
		current: hasThisHour(hourly) ? hourly[0] ?? null : null,
		hourly,
		daily: nearestStation.daily,
	}
}

async function fetchOpenMeteo (lat: number, lon: number): Promise<RawWeather | null> {
	const params = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		hourly: [
			"temperature_2m",
			"apparent_temperature",
			"precipitation_probability",
			"weather_code",
			"wind_speed_10m",
		].join(","),
		daily: [
			"temperature_2m_max",
			"temperature_2m_min",
			"apparent_temperature_max",
		].join(","),
		timezone: "America/Toronto",
		forecast_days: "2",
	})
	try {
		const response = await fetch(
			`https://api.open-meteo.com/v1/forecast?${params.toString()}`,
			{ cache: "no-store", signal: AbortSignal.timeout(8000) },
		)
		if (!response.ok) {
			return null
		}
		const data = (await response.json()) as {
			hourly?: Record<string, Array<number | string | null>>
			daily?: Record<string, Array<number | string | null>>
		}
		const hourly = fromThisHour(columnsToRows(data.hourly ?? {}))
		const daily = columnsToRows(data.daily ?? {}).map((row) => {
			const { time, ...rest } = row
			return { ...rest, date: time }
		})
		return {
			source: "live",
			stationName: null,
			current: hasThisHour(hourly) ? hourly[0] ?? null : null,
			hourly,
			daily,
		}
	} catch {
		return null
	}
}

function columnsToRows (section: Record<string, Array<number | string | null>>): WeatherRow[] {
	const names = Object.keys(section)
	const length = section[names[0] ?? ""]?.length ?? 0
	const rows: WeatherRow[] = []
	for (let index = 0; index < length; index += 1) {
		const row: WeatherRow = {}
		for (const name of names) {
			row[name] = section[name]?.[index] ?? null
		}
		rows.push(row)
	}
	return rows
}

function fromThisHour (hourly: WeatherRow[]): WeatherRow[] {
	const start = torontoHourStart()
	return hourly.filter((row) => {
		const time = row.time
		return typeof time === "string" && new Date(time).getTime() >= start
	})
}

function hasThisHour (hourly: WeatherRow[]): boolean {
	const time = hourly[0]?.time
	return typeof time === "string" && new Date(time).getTime() === torontoHourStart()
}

function torontoHourStart (now = new Date()): number {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: "America/Toronto",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		hourCycle: "h23",
	}).formatToParts(now)
	const value = (type: string) => Number(parts.find((part) => part.type === type)?.value)
	const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"))
	return asUtc - torontoOffsetMinutes(now) * 60 * 1000
}

function torontoOffsetMinutes (date: Date): number {
	const name = new Intl.DateTimeFormat("en-US", {
		timeZone: "America/Toronto",
		timeZoneName: "shortOffset",
	})
		.formatToParts(date)
		.find((part) => part.type === "timeZoneName")?.value ?? "GMT-5"
	const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name)
	if (!match) {
		return -300
	}
	const sign = match[1] === "-" ? -1 : 1
	return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0))
}

function closest<T extends { latitude: number; longitude: number }>(
	stations: T[],
	lat: number,
	lon: number,
): T | null {
	let best: T | null = null
	let bestKm = Number.POSITIVE_INFINITY
	for (const station of stations) {
		const km = distanceKm(lat, lon, station.latitude, station.longitude)
		if (km < bestKm) {
			best = station
			bestKm = km
		}
	}
	if (!best || bestKm > MAX_STATION_KM) {
		return null
	}
	return best
}

function distanceKm (lat1: number, lon1: number, lat2: number, lon2: number): number {
	const earth = 6371
	const dLat = radians(lat2 - lat1)
	const dLon = radians(lon2 - lon1)
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2
	return 2 * earth * Math.asin(Math.sqrt(a))
}

function radians (degrees: number): number {
	return (degrees * Math.PI) / 180
}

async function readJson<T> (filename: string): Promise<T | null> {
	try {
		const text = await readFile(
			path.join(process.cwd(), "backend", "data", filename),
			"utf8",
		)
		return JSON.parse(text) as T
	} catch {
		return null
	}
}
