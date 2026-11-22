import type { Place } from "@/data/mock"
import { MAP_H, MAP_W } from "@/lib/routing"

export interface GeocodeHit {
  name: string
  subtitle: string
  lat: number
  lng: number
}

const WEST = -73.98
const EAST = -73.47
const SOUTH = 45.4
const NORTH = 45.71

export function placeFromGeocode(hit: GeocodeHit, id?: string): Place {
  return placeAt(hit.name, hit.lng, hit.lat, hit.subtitle, id)
}

export function placeAt(name: string, lng: number, lat: number, subtitle = "", id?: string): Place {
  const x = ((lng - WEST) / (EAST - WEST)) * MAP_W
  const y = ((NORTH - lat) / (NORTH - SOUTH)) * MAP_H
  return {
    id: id ?? `${lng.toFixed(5)},${lat.toFixed(5)}`,
    name,
    neighborhood: subtitle,
    x,
    y,
    lat,
    lon: lng,
    keywords: [],
    description: subtitle,
    shaded: false,
  }
}
