export const APP_NAME = "Clair"

export type Point = { x: number; y: number }

export type Mode = "walk" | "bike"

export type AirLevel = "good" | "acceptable" | "poor"

export type Level = 1 | 2 | 3

export type ConditionKey = "asthma" | "copd" | "heat"

export type Health = Record<ConditionKey, Level | null>

export type Place = {
  id: string
  name: string
  neighborhood: string
  x: number
  y: number
  lat: number
  lon: number
  keywords: string[]
  description: string
  shaded: boolean
}

export type Scenario = {
  id: number
  index: number
  pollutant: string
  previous: number
  temp: number
  feels: number
  sky: string
  wind: number
  best: string
  heatWarning: boolean
}

export const EMPTY_HEALTH: Health = { asthma: null, copd: null, heat: null }

export const LEVEL_LABEL: Record<Level, string> = {
  1: "Low",
  2: "Medium",
  3: "High",
}

export const CONDITIONS: { key: ConditionKey; label: string }[] = [
  { key: "asthma", label: "Asthma" },
  { key: "copd", label: "COPD" },
  { key: "heat", label: "Heat sensitivity" },
]

export const PLACES: Place[] = [
  {
    id: "current",
    name: "Current location",
    neighborhood: "Mile End",
    x: 330,
    y: 330,
    lat: 45.5236,
    lon: -73.6002,
    keywords: ["here", "my location", "mile end", "current location", "current"],
    description: "your current location",
    shaded: false,
  },
  {
    id: "fontaine",
    name: "Parc La Fontaine",
    neighborhood: "Plateau-Mont-Royal",
    x: 285,
    y: 215,
    lat: 45.5269,
    lon: -73.5693,
    keywords: ["lafontaine", "la fontaine", "fontaine", "plateau"],
    description: "a big park with lots of shade",
    shaded: true,
  },
  {
    id: "jean-talon",
    name: "Jean-Talon Market",
    neighborhood: "Little Italy",
    x: 560,
    y: 120,
    lat: 45.5364,
    lon: -73.6151,
    keywords: ["jean-talon", "jean talon", "talon", "little italy"],
    description: "open-air market on quiet side streets",
    shaded: false,
  },
  {
    id: "atwater",
    name: "Atwater Market",
    neighborhood: "Saint-Henri",
    x: 720,
    y: 470,
    lat: 45.4797,
    lon: -73.577,
    keywords: ["atwater", "saint-henri", "saint henri", "lachine"],
    description: "market beside the Lachine Canal path",
    shaded: false,
  },
  {
    id: "mcgill",
    name: "McGill University",
    neighborhood: "Downtown",
    x: 930,
    y: 190,
    lat: 45.5048,
    lon: -73.5773,
    keywords: ["mcgill", "university"],
    description: "tree-lined campus paths",
    shaded: true,
  },
  {
    id: "old-port",
    name: "Old Port",
    neighborhood: "Vieux-Montréal",
    x: 1000,
    y: 520,
    lat: 45.5067,
    lon: -73.554,
    keywords: ["old port", "vieux-montreal", "vieux-montréal", "vieux"],
    description: "waterfront with a river breeze",
    shaded: false,
  },
]

export const CURRENT_LOCATION = PLACES[0]

export const DESTINATIONS = PLACES.filter((place) => place.id !== "current")

export const SCENARIOS: Scenario[] = [
  {
    id: 1,
    index: 42,
    pollutant: "Ozone",
    previous: 25,
    temp: 29,
    feels: 35,
    sky: "Sunny",
    wind: 5,
    best: "After 7 pm",
    heatWarning: true,
  },
  {
    id: 2,
    index: 62,
    pollutant: "PM2.5",
    previous: 48,
    temp: 31,
    feels: 38,
    sky: "Hazy sun",
    wind: 3,
    best: "Tomorrow morning",
    heatWarning: true,
  },
  {
    id: 3,
    index: 18,
    pollutant: "Ozone",
    previous: 20,
    temp: 22,
    feels: 22,
    sky: "Partly cloudy",
    wind: 14,
    best: "Any time",
    heatWarning: false,
  },
]

export const FORECAST = [
  { id: "morning", label: "the morning", index: 22, advice: "before noon" },
  { id: "midday", label: "the middle of the day", index: 30, advice: "around midday" },
  { id: "afternoon", label: "the afternoon", index: 52, advice: "in the afternoon" },
  { id: "evening", label: "the evening", index: 35, advice: "in the evening" },
] as const

export type ForecastId = (typeof FORECAST)[number]["id"]

export function placeById(id: string): Place {
  const place = PLACES.find((item) => item.id === id)
  if (!place) {
    throw new Error(`Unknown place ${id}`)
  }
  return place
}

export function filterPlaces(query: string): Place[] {
  const q = query.trim().toLowerCase()
  if (!q) {
    return PLACES
  }
  return PLACES.filter((place) => {
    if (place.name.toLowerCase().includes(q)) {
      return true
    }
    return place.keywords.some((keyword) => keyword.includes(q))
  })
}

export function detectPlace(text: string): Place | null {
  const q = text.toLowerCase()
  let best: { place: Place; score: number } | null = null
  for (const place of DESTINATIONS) {
    const keys = [place.name.toLowerCase(), ...place.keywords]
    for (const key of keys) {
      if (key.length < 4) {
        continue
      }
      if (q.includes(key) && (!best || key.length > best.score)) {
        best = { place, score: key.length }
      }
    }
  }
  return best?.place ?? null
}

export function highestLevel(health: Health): number {
  return Math.max(health.asthma ?? 0, health.copd ?? 0, health.heat ?? 0)
}

export function levelForIndex(index: number): AirLevel {
  if (index <= 25) {
    return "good"
  }
  if (index <= 50) {
    return "acceptable"
  }
  return "poor"
}

export function levelLabel(level: AirLevel): string {
  if (level === "good") {
    return "Good"
  }
  if (level === "acceptable") {
    return "Acceptable"
  }
  return "Poor"
}

export function pollutantReadings(index: number) {
  return {
    pm25: Math.round(index * 0.26),
    no2: Math.round(index * 0.41),
    o3: Math.round(index * 0.9),
    so2: Math.round(index * 0.06) + 1,
  }
}

export function conditionSummary(health: Health): string {
  const parts: string[] = []
  if (health.asthma) {
    parts.push(`Asthma ${LEVEL_LABEL[health.asthma]}`)
  }
  if (health.copd) {
    parts.push(`COPD ${LEVEL_LABEL[health.copd]}`)
  }
  if (health.heat) {
    parts.push(`Heat ${LEVEL_LABEL[health.heat]}`)
  }
  return parts.join(", ")
}

export function airCardNote(health: Health, level: AirLevel): string {
  const prefix = level === "poor" ? "Bad-air mode on. " : ""
  const summary = conditionSummary(health)
  if (!summary) {
    return `${prefix}Add health info for advice that fits you.`
  }
  const tail =
    highestLevel(health) >= 2
      ? "Take the cleaner route today."
      : "Standard clean-air mode is fine."
  return `${prefix}${summary}. ${tail}`
}

export function airDirectionLine(level: AirLevel, index: number): string {
  const extra =
    level === "poor"
      ? "Bad-air mode is on, so the cleaner route is stricter. Consider going later or taking the metro."
      : level === "acceptable"
        ? "Cleaner route recommended."
        : "Good conditions today."
  return `Air quality: ${levelLabel(level)} (${index}). ${extra}`
}

export function weatherAdvice(level: AirLevel): string {
  if (level === "good") {
    return "Air is clear for most people today"
  }
  if (level === "acceptable") {
    return "Sensitive groups may notice it today"
  }
  return "Sensitive groups should limit time outside"
}

export function windNote(speed: number): string {
  return speed >= 10 ? "Breezy, good mixing" : "Light, little mixing"
}

export function trendText(index: number, previous: number): string {
  if (index > previous) {
    return `Worse, up from ${previous}`
  }
  if (index < previous) {
    return `Better, down from ${previous}`
  }
  return `Steady at ${previous}`
}

export function format1(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1)
}

export function formatClock(date: Date): string {
  let hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const suffix = hours >= 12 ? "pm" : "am"
  hours = hours % 12 || 12
  return `${hours}:${minutes} ${suffix}`
}
