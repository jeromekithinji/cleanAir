/** Environment Canada city page and AQHI forecast for Montréal. */

const CITY = "s0000635"
const CITY_ROOT = "https://dd.weather.gc.ca/today/citypage_weather/QC"
const AQHI_ROOT =
	"https://dd.weather.gc.ca/today/air_quality/aqhi/que/forecast/model/csv"

export interface CanadaWeather {
	temperatureC: number | null
	feelsLikeC: number | null
	conditions: string | null
	wind: string | null
	alerts: string[]
	observedAt: string | null
}

export interface AqhiPeriod {
	time: string
	aqhi: number
}

interface CacheEntry<T> {
	at: number
	value: T
}

const CACHE_MS = 10 * 60 * 1000
let weatherCache: CacheEntry<CanadaWeather | null> | null = null
let aqhiCache: CacheEntry<AqhiPeriod[] | null> | null = null

export async function readCanadaWeather (): Promise<CanadaWeather | null> {
	if (weatherCache && Date.now() - weatherCache.at < CACHE_MS) {
		return weatherCache.value
	}
	const value = await loadWeather()
	weatherCache = { at: Date.now(), value }
	return value
}

export async function readAqhiForecast (): Promise<AqhiPeriod[] | null> {
	if (aqhiCache && Date.now() - aqhiCache.at < CACHE_MS) {
		return aqhiCache.value
	}
	const value = await loadAqhi()
	aqhiCache = { at: Date.now(), value }
	return value
}

async function loadWeather (): Promise<CanadaWeather | null> {
	const now = new Date()
	const hours = [now, new Date(now.getTime() - 60 * 60 * 1000)]
	for (const date of hours) {
		const hour = String(date.getUTCHours()).padStart(2, "0")
		const listing = await getText(`${CITY_ROOT}/${hour}/`)
		if (!listing) {
			continue
		}
		const names = [...listing.matchAll(/href="([^"]+)"/g)]
			.map((match) => match[1] ?? "")
			.filter((name) => name.includes(`${CITY}_en.xml`))
		const file = names.sort().at(-1)
		if (!file) {
			continue
		}
		const xml = await getText(`${CITY_ROOT}/${hour}/${file}`)
		if (xml) {
			return parseCityPage(xml)
		}
	}
	return null
}

async function loadAqhi (): Promise<AqhiPeriod[] | null> {
	const listing = await getText(`${AQHI_ROOT}/`)
	if (!listing) {
		return null
	}
	const file = [...listing.matchAll(/href="([^"]*AQHI_QC_AQFM\.csv)"/g)]
		.map((match) => match[1] ?? "")
		.sort()
		.at(-1)
	if (!file) {
		return null
	}
	const csv = await getText(`${AQHI_ROOT}/${file}`)
	if (!csv) {
		return null
	}
	return parseAqhi(csv)
}

function parseCityPage (xml: string): CanadaWeather | null {
	const current = xml.match(
		/<currentConditions>([\s\S]*?)<\/currentConditions>/,
	)?.[1]
	if (!current) {
		return null
	}
	const temperature = numberTag(current, "temperature")
	const humidex = numberTag(current, "humidex")
	const speed = numberTag(current, "speed")
	const direction = textTag(current, "direction")
	const warnings = xml.match(/<warnings>([\s\S]*?)<\/warnings>/)?.[1] ?? ""
	const alerts = [...warnings.matchAll(/description="([^"]+)"/g)].map(
		(match) => decode(match[1] ?? ""),
	)
	const observed =
		current.match(/zone="EST"[\s\S]*?<textSummary>([^<]+)<\/textSummary>/)
			?.[1] ?? null
	return {
		temperatureC: temperature,
		feelsLikeC: humidex,
		conditions: textTag(current, "condition"),
		wind:
			speed == null
				? null
				: `${direction ?? ""} ${speed} km/h`.trim(),
		alerts,
		observedAt: observed,
	}
}

function parseAqhi (csv: string): AqhiPeriod[] | null {
	const lines = csv.trim().split(/\r?\n/).filter(Boolean)
	const header = lines[0]?.split(",") ?? []
	const montreal = lines.find((line) => /montr[eé]al/i.test(line))
	if (!montreal) {
		return null
	}
	const cells = montreal.split(",")
	const periods: AqhiPeriod[] = []
	for (let index = 1; index < header.length && periods.length < 4; index += 1) {
		const value = Number(cells[index])
		const stamp = header[index]
		if (!stamp || !Number.isFinite(value)) {
			continue
		}
		periods.push({ time: stamp, aqhi: Math.round(value) })
	}
	return periods.length > 0 ? periods : null
}

function numberTag (xml: string, tag: string): number | null {
	const text = xml.match(new RegExp(`<${tag}[^>]*>([0-9.]+)</${tag}>`))?.[1]
	const value = text == null ? NaN : Number(text)
	return Number.isFinite(value) ? value : null
}

function textTag (xml: string, tag: string): string | null {
	const text = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`))?.[1]
	return text ? decode(text) : null
}

function decode (value: string): string {
	return value
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, "\"")
		.trim()
}

async function getText (url: string): Promise<string | null> {
	try {
		const response = await fetch(url, {
			cache: "no-store",
			signal: AbortSignal.timeout(4000),
			headers: { Accept: "application/xml, text/plain, */*" },
		})
		if (!response.ok) {
			return null
		}
		return await response.text()
	} catch {
		return null
	}
}
