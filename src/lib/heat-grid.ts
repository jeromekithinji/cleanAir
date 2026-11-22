import { cacheLife } from "next/cache"

/**
 * Feels-like temperature on a grid over Montréal, for the exposure map's heat layer.
 * One Open-Meteo request for every grid point (free, no key), cached for an hour.
 */

// Same box as address search (src/app/api/geocode/route.ts).
const WEST = -73.98
const EAST = -73.47
const SOUTH = 45.4
const NORTH = 45.71
// About 3.5 km between points, close to Open-Meteo's model resolution for Canada.
const STEP_LON = 0.045
const STEP_LAT = 0.03

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast"

export type HeatGrid = {
  /** When Open-Meteo computed the values (local time, e.g. "2026-11-22T14:00"). */
  time: string | null
  minC: number | null
  maxC: number | null
  points: GeoJSON.FeatureCollection<GeoJSON.Point, { feels: number }>
}

type OpenMeteoPoint = {
  latitude: number
  longitude: number
  current?: { time?: string; apparent_temperature?: number | null }
}

function gridPoints(): { lat: number; lon: number }[] {
  const points: { lat: number; lon: number }[] = []
  for (let lat = SOUTH; lat <= NORTH + 1e-9; lat += STEP_LAT) {
    for (let lon = WEST; lon <= EAST + 1e-9; lon += STEP_LON) {
      points.push({ lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)) })
    }
  }
  return points
}

export async function readHeatGrid(): Promise<HeatGrid> {
  "use cache"
  cacheLife("hours")

  const grid = gridPoints()
  const params = new URLSearchParams({
    latitude: grid.map((point) => point.lat).join(","),
    longitude: grid.map((point) => point.lon).join(","),
    current: "apparent_temperature",
    timezone: "America/Toronto",
  })
  const response = await fetch(`${OPEN_METEO}?${params.toString()}`, {
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    throw new Error(`Open-Meteo answered ${response.status}`)
  }
  const data = (await response.json()) as OpenMeteoPoint[] | OpenMeteoPoint
  const locations = Array.isArray(data) ? data : [data]

  const features: HeatGrid["points"]["features"] = []
  let time: string | null = null
  locations.forEach((location, index) => {
    const feels = location.current?.apparent_temperature
    if (typeof feels !== "number") {
      return
    }
    time ??= location.current?.time ?? null
    // Keep the grid point we asked for, not Open-Meteo's snapped cell centre,
    // so the layer stays evenly spaced.
    const point = grid[index]
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [point.lon, point.lat] },
      properties: { feels },
    })
  })

  const values = features.map((feature) => feature.properties.feels)
  return {
    time,
    minC: values.length ? Math.min(...values) : null,
    maxC: values.length ? Math.max(...values) : null,
    points: { type: "FeatureCollection", features },
  }
}
