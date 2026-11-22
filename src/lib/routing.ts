import type { Mode, Point } from "@/data/mock"
import type { RouteOption as ApiRoute, RoutesResponse } from "@/lib/types"

export const MAP_W = 1200
export const MAP_H = 800
export const METERS_PER_UNIT = 5

const WALK_KMH = 5
const BIKE_KMH = 15

const BUSY_Y0 = 520
const BUSY_DX = 1200
const BUSY_DY = -270
const BUSY_LEN2 = BUSY_DX * BUSY_DX + BUSY_DY * BUSY_DY
const BUSY_LEN = Math.sqrt(BUSY_LEN2)

/** Keeps the cleaner route's detour point a little inside the map edge. */
const CLAMP_MARGIN = 30
/** How much the detour grows on each retry until the cleaner route is long enough. */
const OFFSET_STEP = 25
const MAX_TRIES = 7

export type RouteId = "fast" | "clean"

export type RouteOption = {
  id: RouteId
  name: string
  bubble: string
  points: Point[]
  /** Street geometry from GraphHopper, as [lon, lat]. */
  coordinates?: [number, number][]
  km: number
  minutes: number
  busy: number
  drivingCo2g?: number
  busyMinutes?: number
  shadePct?: number | null
}

export type PlannedRoutes = {
  routes: RoutePair
  tradeoff: string
  explanations: string[]
  suggestMetro: boolean
  tunedFor: string[]
  advisory: string | null
  healthCost: number | null
}

export type RoutePair = {
  fast: RouteOption
  clean: RouteOption
}

function fromApiRoute(
  option: ApiRoute,
  bubble: string,
  shadePct: number | null,
): RouteOption {
  return {
    id: option.id,
    name: option.label,
    bubble,
    points: [],
    coordinates: option.geometry.coordinates.map((pair) => [pair[0], pair[1]]),
    km: option.distance_meters / 1000,
    minutes: Math.max(1, Math.round(option.duration_seconds / 60)),
    busy: option.busy_share,
    drivingCo2g: option.driving_co2_g,
    busyMinutes: Math.round(option.busy_time_seconds / 60),
    shadePct,
  }
}

/** Map POST /api/route into the two cards and the line drawn on the map. */
export function pairFromResponse(response: RoutesResponse): PlannedRoutes {
  const fast = response.routes.find((route) => route.id === "fast")
  const clean = response.routes.find((route) => route.id === "clean")
  if (!fast || !clean) {
    throw new Error("The route service did not return both routes.")
  }
  return {
    routes: {
      fast: fromApiRoute(fast, "Fastest", response.shade_pct?.fast ?? null),
      clean: fromApiRoute(clean, "Health", response.shade_pct?.clean ?? null),
    },
    tradeoff: response.tradeoff,
    explanations: clean.explanations,
    suggestMetro: response.suggest_metro,
    tunedFor: response.tuned_for ?? [],
    advisory: response.advisory ?? null,
    healthCost: response.health_cost ?? null,
  }
}

export function samePoint(a: Point, b: Point): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < 1
}

function projectOntoBusy(point: Point): Point {
  const t = (point.x * BUSY_DX + (point.y - BUSY_Y0) * BUSY_DY) / BUSY_LEN2
  return { x: BUSY_DX * t, y: BUSY_Y0 + BUSY_DY * t }
}

function crossBusy(point: Point): number {
  return point.x * BUSY_DY - (point.y - BUSY_Y0) * BUSY_DX
}

function distanceToBusy(point: Point): number {
  return Math.abs(crossBusy(point)) / BUSY_LEN
}

function pushAway(mid: Point, offset: number): Point {
  const sign = crossBusy(mid) >= 0 ? 1 : -1
  const ux = sign * (BUSY_DY / BUSY_LEN)
  const uy = sign * (-BUSY_DX / BUSY_LEN)
  return {
    x: clamp(mid.x + ux * offset, CLAMP_MARGIN, MAP_W - CLAMP_MARGIN),
    y: clamp(mid.y + uy * offset, CLAMP_MARGIN, MAP_H - CLAMP_MARGIN),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function polylineLength(points: Point[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }
  return total
}

function fastestPath(start: Point, end: Point): Point[] {
  return [start, projectOntoBusy(start), projectOntoBusy(end), end]
}

function cleanerPath(start: Point, end: Point, offset: number): Point[] {
  const mid = pushAway(
    { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    offset,
  )
  return [start, { x: start.x, y: mid.y }, mid, { x: mid.x, y: end.y }, end]
}

function busyShare(points: Point[]): number {
  const samples: Point[] = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    const steps = Math.max(1, Math.round(length / 4))
    for (let step = 0; step < steps; step++) {
      const t = step / steps
      samples.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      })
    }
  }
  samples.push(points[points.length - 1])
  if (samples.length === 0) {
    return 0
  }
  const near = samples.filter((point) => distanceToBusy(point) <= 18).length
  return near / samples.length
}

function toKm(units: number): number {
  return (units * METERS_PER_UNIT) / 1000
}

function toMinutes(km: number, mode: Mode): number {
  const speed = mode === "bike" ? BIKE_KMH : WALK_KMH
  return Math.max(1, Math.round((km / speed) * 60))
}

function asRoute(
  id: RouteId,
  name: string,
  bubble: string,
  points: Point[],
  mode: Mode,
): RouteOption {
  const km = toKm(polylineLength(points))
  return {
    id,
    name,
    bubble,
    points,
    km,
    minutes: toMinutes(km, mode),
    busy: busyShare(points),
  }
}

export function buildRoutes(
  start: Point,
  end: Point,
  mode: Mode,
  highestSensitivity: number,
  poorAir: boolean,
): RoutePair | null {
  if (samePoint(start, end)) {
    return null
  }
  const fastPoints = fastestPath(start, end)
  const fastLength = polylineLength(fastPoints)
  let offset = 110 + 45 * highestSensitivity + (poorAir ? 90 : 0)
  let cleanPoints = cleanerPath(start, end, offset)
  let tries = 0
  while (polylineLength(cleanPoints) < fastLength * 1.1 && tries < MAX_TRIES) {
    offset += OFFSET_STEP
    cleanPoints = cleanerPath(start, end, offset)
    tries += 1
  }
  return {
    fast: asRoute("fast", "Fastest", "Fastest", fastPoints, mode),
    clean: asRoute("clean", "Cleaner air", "Cleaner", cleanPoints, mode),
  }
}

export function tradeoffLine(fast: RouteOption, clean: RouteOption): string {
  const extra = clean.minutes - fast.minutes
  const time = extra <= 0 ? "No extra time" : `+${extra} min`
  if (fast.busy < 0.05) {
    return `${time}. Both routes already avoid busy roads.`
  }
  const less = Math.max(0, Math.round(((fast.busy - clean.busy) / fast.busy) * 100))
  return `${time}, ${less}% less time on busy roads`
}

export function routeExplanations(
  fast: RouteOption,
  health: { asthma: number | null; copd: number | null; heat: number | null },
  poorAir: boolean,
): string[] {
  const lines: string[] = []
  if (fast.busy >= 0.05) {
    lines.push("We avoided Notre-Dame Street because it's a heavy truck route.")
  }
  lines.push("We chose quieter side streets and kept away from major roads where we could.")
  if (poorAir) {
    lines.push("Air quality is poor right now, so bad-air mode made the cleaner route stricter.")
  }
  const labels = { 1: "Low", 2: "Medium", 3: "High" } as const
  const chosen: { name: string; level: 1 | 2 | 3; heat: boolean }[] = []
  if (health.asthma) {
    chosen.push({ name: "Asthma", level: health.asthma as 1 | 2 | 3, heat: false })
  }
  if (health.copd) {
    chosen.push({ name: "COPD", level: health.copd as 1 | 2 | 3, heat: false })
  }
  if (health.heat) {
    chosen.push({ name: "Heat sensitivity", level: health.heat as 1 | 2 | 3, heat: true })
  }
  if (chosen.length === 0) {
    lines.push("No health info added, so we used the standard clean-air setting.")
  } else {
    for (const item of chosen) {
      const action = item.heat
        ? "we favoured streets with more trees and shade."
        : "we kept you farther from traffic."
      lines.push(`${item.name} (${labels[item.level]}): ${action}`)
    }
  }
  return lines
}

export function pointAlong(points: Point[], fraction: number): Point & { nx: number; ny: number } {
  const total = polylineLength(points)
  let remaining = total * fraction
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.hypot(dx, dy)
    if (remaining <= length || i === points.length - 1) {
      const t = length === 0 ? 0 : Math.min(1, remaining / length)
      const x = a.x + dx * t
      const y = a.y + dy * t
      const nx = length === 0 ? 0 : -dy / length
      const ny = length === 0 ? -1 : dx / length
      const sign = ny > 0 ? -1 : 1
      return { x, y, nx: nx * sign, ny: ny * sign }
    }
    remaining -= length
  }
  return { x: points[0].x, y: points[0].y, nx: 0, ny: -1 }
}

export function toPath(points: Point[]): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join("")
}
