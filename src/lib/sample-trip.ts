import type { Place, RouteOption, RoutesResponse } from "@/lib/types"

export interface SamplePlace extends Place {
  neighbourhood: string
}

/** Downtown, used when a sample trip starts or ends there. */
export const SAMPLE_ORIGIN: SamplePlace = {
  label: "Downtown",
  neighbourhood: "Ville-Marie",
  lat: 45.5019,
  lon: -73.5702,
}

export const SAMPLE_PLACES: SamplePlace[] = [
  SAMPLE_ORIGIN,
  {
    label: "Atwater Market",
    neighbourhood: "Sud-Ouest",
    lat: 45.4796,
    lon: -73.5773,
  },
  {
    label: "Parc La Fontaine",
    neighbourhood: "Le Plateau",
    lat: 45.5266,
    lon: -73.5694,
  },
  {
    label: "Jean-Talon Market",
    neighbourhood: "Little Italy",
    lat: 45.5364,
    lon: -73.6147,
  },
  {
    label: "Old Port",
    neighbourhood: "Ville-Marie",
    lat: 45.5068,
    lon: -73.5542,
  },
  {
    label: "Mount Royal chalet",
    neighbourhood: "Mount Royal",
    lat: 45.5048,
    lon: -73.5874,
  },
]

const ORIGIN: [number, number] = [SAMPLE_ORIGIN.lon, SAMPLE_ORIGIN.lat]

interface SamplePath {
  fast: [number, number][]
  clean: [number, number][]
  fastMinutes: number
  cleanMinutes: number
  fastMeters: number
  cleanMeters: number
  fastBusy: number
  cleanBusy: number
  explanation: string
}

const PATHS: Record<string, SamplePath> = {
  "Atwater Market": {
    fast: [
      ORIGIN,
      [-73.5665, 45.495],
      [-73.56, 45.489],
      [-73.568, 45.4835],
      [-73.5773, 45.4796],
    ],
    clean: [
      ORIGIN,
      [-73.5815, 45.5016],
      [-73.5818, 45.491],
      [-73.5748, 45.4906],
      [-73.5746, 45.4818],
      [-73.5773, 45.4796],
    ],
    fastMinutes: 28,
    cleanMinutes: 32,
    fastMeters: 2300,
    cleanMeters: 2600,
    fastBusy: 0.71,
    cleanBusy: 0.22,
    explanation:
      "We avoided Notre-Dame Street because it is a heavy truck route.",
  },
  "Parc La Fontaine": {
    fast: [
      ORIGIN,
      [-73.5702, 45.512],
      [-73.5688, 45.5185],
      [-73.5694, 45.5266],
    ],
    clean: [
      ORIGIN,
      [-73.5768, 45.5022],
      [-73.5772, 45.514],
      [-73.5734, 45.5198],
      [-73.5694, 45.5266],
    ],
    fastMinutes: 34,
    cleanMinutes: 39,
    fastMeters: 2900,
    cleanMeters: 3300,
    fastBusy: 0.64,
    cleanBusy: 0.18,
    explanation: "We avoided Saint-Denis Street because it is a busy main road.",
  },
  "Jean-Talon Market": {
    fast: [
      ORIGIN,
      [-73.578, 45.508],
      [-73.594, 45.522],
      [-73.608, 45.53],
      [-73.6147, 45.5364],
    ],
    clean: [
      ORIGIN,
      [-73.584, 45.503],
      [-73.592, 45.512],
      [-73.601, 45.524],
      [-73.61, 45.531],
      [-73.6147, 45.5364],
    ],
    fastMinutes: 46,
    cleanMinutes: 52,
    fastMeters: 5200,
    cleanMeters: 5700,
    fastBusy: 0.68,
    cleanBusy: 0.24,
    explanation:
      "We avoided Saint-Laurent Boulevard because it is a busy main road.",
  },
  "Old Port": {
    fast: [
      ORIGIN,
      [-73.562, 45.5028],
      [-73.556, 45.5048],
      [-73.5542, 45.5068],
    ],
    clean: [
      ORIGIN,
      [-73.568, 45.498],
      [-73.56, 45.4984],
      [-73.5555, 45.503],
      [-73.5542, 45.5068],
    ],
    fastMinutes: 16,
    cleanMinutes: 20,
    fastMeters: 1400,
    cleanMeters: 1800,
    fastBusy: 0.58,
    cleanBusy: 0.16,
    explanation:
      "We avoided Rue de la Commune because it is a busy main road.",
  },
  "Mount Royal chalet": {
    fast: [
      ORIGIN,
      [-73.576, 45.503],
      [-73.582, 45.5042],
      [-73.5874, 45.5048],
    ],
    clean: [
      ORIGIN,
      [-73.574, 45.5075],
      [-73.58, 45.5088],
      [-73.586, 45.5064],
      [-73.5874, 45.5048],
    ],
    fastMinutes: 22,
    cleanMinutes: 26,
    fastMeters: 1700,
    cleanMeters: 2100,
    fastBusy: 0.49,
    cleanBusy: 0.12,
    explanation: "We left the main climb and stayed on the park paths.",
  },
}

function routeOption(
  id: "fast" | "clean",
  label: string,
  coordinates: [number, number][],
  minutes: number,
  meters: number,
  busyShare: number,
  explanations: string[],
): RouteOption {
  const drivingCo2 = Math.round((meters / 1000) * 251)
  return {
    id,
    label,
    duration_seconds: minutes * 60,
    distance_meters: meters,
    busy_time_seconds: Math.round(minutes * 60 * busyShare),
    busy_share: busyShare,
    trip_co2_g: 0,
    driving_co2_g: drivingCo2,
    geometry: { type: "LineString", coordinates },
    explanations,
  }
}

function metersBetween(origin: Place, destination: Place): number {
  const earth = 6371000
  const lat1 = (origin.lat * Math.PI) / 180
  const lat2 = (destination.lat * Math.PI) / 180
  const dLat = ((destination.lat - origin.lat) * Math.PI) / 180
  const dLon = ((destination.lon - origin.lon) * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * earth * Math.asin(Math.sqrt(h))
}

function bentPath(
  origin: Place,
  destination: Place,
  bend: number,
): [number, number][] {
  const start: [number, number] = [origin.lon, origin.lat]
  const end: [number, number] = [destination.lon, destination.lat]
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const length = Math.hypot(dx, dy) || 1
  const px = (-dy / length) * bend
  const py = (dx / length) * bend
  return [
    start,
    [
      start[0] + dx * 0.3 + px * 0.35,
      start[1] + dy * 0.3 + py * 0.35,
    ],
    [start[0] + dx * 0.55 + px, start[1] + dy * 0.55 + py],
    [
      start[0] + dx * 0.8 + px * 0.4,
      start[1] + dy * 0.8 + py * 0.4,
    ],
    end,
  ]
}

function cannedPath(
  origin: Place,
  destination: Place,
): SamplePath | null {
  if (origin.label === SAMPLE_ORIGIN.label) {
    return PATHS[destination.label] ?? null
  }
  if (destination.label !== SAMPLE_ORIGIN.label) {
    return null
  }
  const path = PATHS[origin.label]
  if (!path) {
    return null
  }
  return {
    ...path,
    fast: [...path.fast].reverse(),
    clean: [...path.clean].reverse(),
  }
}

function tripFromPath(path: SamplePath): RoutesResponse {
  const fastBusy = Math.round(path.fastBusy * 100)
  const cleanBusy = Math.round(path.cleanBusy * 100)
  const drop =
    fastBusy === 0 ? 0 : Math.round((1 - cleanBusy / fastBusy) * 100)
  return {
    tradeoff:
      `+${path.cleanMinutes - path.fastMinutes} min, ` +
      `${drop}% less on busy roads`,
    suggest_metro: false,
    routes: [
      routeOption(
        "fast",
        "Fastest",
        path.fast,
        path.fastMinutes,
        path.fastMeters,
        path.fastBusy,
        [],
      ),
      routeOption(
        "clean",
        "Cleaner air",
        path.clean,
        path.cleanMinutes,
        path.cleanMeters,
        path.cleanBusy,
        [path.explanation],
      ),
    ],
  }
}

function syntheticTrip(
  origin: Place,
  destination: Place,
): RoutesResponse | null {
  const meters = metersBetween(origin, destination)
  if (meters < 40) {
    return null
  }
  const bend = Math.min(0.012, Math.max(0.002, (meters / 1000) * 0.0015))
  const fastMeters = Math.round(meters * 1.12)
  const cleanMeters = Math.round(meters * 1.32)
  const fastMinutes = Math.max(1, Math.round(fastMeters / 75))
  const cleanMinutes = Math.max(
    fastMinutes + 1,
    Math.round(cleanMeters / 70),
  )
  return tripFromPath({
    fast: bentPath(origin, destination, bend * 0.25),
    clean: bentPath(origin, destination, bend),
    fastMinutes,
    cleanMinutes,
    fastMeters,
    cleanMeters,
    fastBusy: 0.66,
    cleanBusy: 0.2,
    explanation:
      "We left the busy main roads and stayed on quieter streets.",
  })
}

/**
 * Sample trip between two places. Replace this function with the
 * /api/route response later. The map only reads RoutesResponse.
 */
export function sampleTrip(
  origin: Place,
  destination: Place,
): RoutesResponse | null {
  const canned = cannedPath(origin, destination)
  if (canned) {
    return tripFromPath(canned)
  }
  return syntheticTrip(origin, destination)
}

export function searchPlaces(query: string): SamplePlace[] {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return []
  }
  return SAMPLE_PLACES.filter((place) => {
    const haystack = `${place.label} ${place.neighbourhood}`.toLowerCase()
    return haystack.includes(needle)
  })
}
