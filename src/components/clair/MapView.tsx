"use client"

/**
 * Stylized SVG map. The camera (pan, zoom, animated moves) is the SVG viewBox.
 * Everything else talks to it through MapViewProps and MapViewHandle, so it can be
 * swapped for MapLibre GL JS later without touching other components.
 */

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from "react"
import type { Point } from "@/data/mock"
import { MAP_H, MAP_W, pointAlong, toPath, type RouteId, type RoutePair } from "@/lib/routing"
import { LEAF_PATH, PIN_PATH, VEIN_PATH } from "./Logo"

export type Insets = { top: number; right: number; bottom: number; left: number }

export type MapViewHandle = {
  zoomBy: (factor: number) => void
  flyTo: (point: Point, zoom?: number) => void
  /** minZoom is relative to the cover scale; defaults to FIT_MIN_ZOOM. */
  fitPoints: (points: Point[], padding: Insets, minZoom?: number) => void
  reset: () => void
}

export type MapViewProps = {
  ref?: Ref<MapViewHandle>
  routes: RoutePair | null
  /** Changes whenever a new pair of route lines is calculated (restarts the draw-in). */
  routeKey: string
  selected: RouteId
  onSelectRoute: (id: RouteId) => void
  start: Point | null
  destination: Point | null
  currentLocation: Point
  label: string
}

type Camera = { cx: number; cy: number; s: number }
type Size = { w: number; h: number }

const MAX_ZOOM = 4
const MIN_ZOOM = 0.7
/** Fitting routes never zooms out past this, so streets stay readable. */
const FIT_MIN_ZOOM = 0.88
const DRAG_THRESHOLD = 4
const ANIM_MS = 550
const BUSY_ANGLE = (Math.atan2(250 - 520, 1200) * 180) / Math.PI

function coverScale(size: Size) {
  return Math.max(size.w / MAP_W, size.h / MAP_H)
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function MapView({
  ref,
  routes,
  routeKey,
  selected,
  onSelectRoute,
  start,
  destination,
  currentLocation,
  label,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<Size | null>(null)
  const [camera, setCamera] = useState<Camera>({ cx: MAP_W / 2, cy: MAP_H / 2, s: 1 })
  const cameraRef = useRef(camera)
  const sizeRef = useRef<Size | null>(null)
  const animRef = useRef<number | null>(null)
  const touchedRef = useRef(false)
  const dragRef = useRef<{ x: number; y: number; cam: Camera; moved: boolean; id: number } | null>(null)
  const movedRef = useRef(false)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ dist: number; cam: Camera; mx: number; my: number } | null>(null)

  const commit = useCallback((next: Camera) => {
    cameraRef.current = next
    setCamera(next)
  }, [])

  const clampCamera = useCallback((cam: Camera): Camera => {
    const sz = sizeRef.current
    if (!sz) {
      return cam
    }
    const cover = coverScale(sz)
    return {
      s: Math.min(cover * MAX_ZOOM, Math.max(cover * MIN_ZOOM, cam.s)),
      cx: Math.min(MAP_W, Math.max(0, cam.cx)),
      cy: Math.min(MAP_H, Math.max(0, cam.cy)),
    }
  }, [])

  const stopAnim = useCallback(() => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current)
      animRef.current = null
    }
  }, [])

  const animateTo = useCallback(
    (target: Camera) => {
      stopAnim()
      const to = clampCamera(target)
      if (prefersReducedMotion()) {
        commit(to)
        return
      }
      const from = cameraRef.current
      const t0 = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / ANIM_MS)
        const e = 1 - Math.pow(1 - t, 3)
        commit({
          cx: from.cx + (to.cx - from.cx) * e,
          cy: from.cy + (to.cy - from.cy) * e,
          s: from.s * Math.pow(to.s / from.s, e),
        })
        animRef.current = t < 1 ? requestAnimationFrame(step) : null
      }
      animRef.current = requestAnimationFrame(step)
    },
    [clampCamera, commit, stopAnim],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) {
      return
    }
    const observer = new ResizeObserver(() => {
      const next = { w: el.clientWidth, h: el.clientHeight }
      sizeRef.current = next
      setSize(next)
      if (!touchedRef.current) {
        commit({ cx: MAP_W / 2, cy: MAP_H / 2, s: coverScale(next) })
      } else {
        commit(clampCamera(cameraRef.current))
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [clampCamera, commit])

  useEffect(() => stopAnim, [stopAnim])

  const zoomAround = useCallback(
    (factor: number, mx: number, my: number, base: Camera = cameraRef.current) => {
      const sz = sizeRef.current
      if (!sz) {
        return
      }
      const cover = coverScale(sz)
      const s = Math.min(cover * MAX_ZOOM, Math.max(cover * MIN_ZOOM, base.s * factor))
      const vx = base.cx - sz.w / 2 / base.s
      const vy = base.cy - sz.h / 2 / base.s
      const px = vx + mx / base.s
      const py = vy + my / base.s
      const nvx = px - mx / s
      const nvy = py - my / s
      commit(clampCamera({ s, cx: nvx + sz.w / 2 / s, cy: nvy + sz.h / 2 / s }))
    },
    [clampCamera, commit],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) {
      return
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      stopAnim()
      touchedRef.current = true
      const rect = el.getBoundingClientRect()
      zoomAround(Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top)
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [stopAnim, zoomAround])

  useImperativeHandle(
    ref,
    () => ({
      zoomBy(factor) {
        const sz = sizeRef.current
        if (!sz) {
          return
        }
        touchedRef.current = true
        const cam = cameraRef.current
        animateTo({ ...cam, s: cam.s * factor })
      },
      flyTo(point, zoom = 2) {
        const sz = sizeRef.current
        if (!sz) {
          return
        }
        touchedRef.current = true
        animateTo({ cx: point.x, cy: point.y, s: coverScale(sz) * zoom })
      },
      fitPoints(points, pad, minZoom = FIT_MIN_ZOOM) {
        const sz = sizeRef.current
        if (!sz || points.length === 0) {
          return
        }
        touchedRef.current = true
        const xs = points.map((p) => p.x)
        const ys = points.map((p) => p.y)
        const minX = Math.min(...xs)
        const maxX = Math.max(...xs)
        const minY = Math.min(...ys)
        const maxY = Math.max(...ys)
        const availW = Math.max(80, sz.w - pad.left - pad.right)
        const availH = Math.max(80, sz.h - pad.top - pad.bottom)
        const cover = coverScale(sz)
        const s = Math.min(
          cover * MAX_ZOOM,
          Math.max(cover * Math.max(MIN_ZOOM, minZoom), Math.min(availW / Math.max(1, maxX - minX), availH / Math.max(1, maxY - minY))),
        )
        const screenCx = pad.left + availW / 2
        const screenCy = pad.top + availH / 2
        animateTo({
          s,
          cx: (minX + maxX) / 2 - (screenCx - sz.w / 2) / s,
          cy: (minY + maxY) / 2 - (screenCy - sz.h / 2) / s,
        })
      },
      reset() {
        const sz = sizeRef.current
        if (!sz) {
          return
        }
        touchedRef.current = false
        animateTo({ cx: MAP_W / 2, cy: MAP_H / 2, s: coverScale(sz) })
      },
    }),
    [animateTo],
  )

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") {
      return
    }
    stopAnim()
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    movedRef.current = false
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()]
      const rect = event.currentTarget.getBoundingClientRect()
      pinchRef.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        cam: cameraRef.current,
        mx: (a.x + b.x) / 2 - rect.left,
        my: (a.y + b.y) / 2 - rect.top,
      }
      dragRef.current = null
      return
    }
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      cam: cameraRef.current,
      moved: false,
      id: event.pointerId,
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) {
      return
    }
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const pinch = pinchRef.current
    if (pinch && pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      movedRef.current = true
      touchedRef.current = true
      zoomAround(dist / pinch.dist, pinch.mx, pinch.my, pinch.cam)
      return
    }
    const drag = dragRef.current
    if (!drag || drag.id !== event.pointerId) {
      return
    }
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      drag.moved = true
      movedRef.current = true
      touchedRef.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    if (drag.moved) {
      commit(clampCamera({ ...drag.cam, cx: drag.cam.cx - dx / drag.cam.s, cy: drag.cam.cy - dy / drag.cam.s }))
    }
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId)
    if (pointersRef.current.size < 2) {
      pinchRef.current = null
    }
    if (dragRef.current?.id === event.pointerId) {
      dragRef.current = null
    }
  }

  const select = (id: RouteId) => {
    if (movedRef.current) {
      return
    }
    onSelectRoute(id)
  }

  const s = camera.s
  const k = 1 / s
  const viewBox = size
    ? `${camera.cx - size.w / 2 / s} ${camera.cy - size.h / 2 / s} ${size.w / s} ${size.h / s}`
    : `0 0 ${MAP_W} ${MAP_H}`
  const toScreen = (p: Point) =>
    size
      ? { left: (p.x - (camera.cx - size.w / 2 / s)) * s, top: (p.y - (camera.cy - size.h / 2 / s)) * s }
      : { left: 0, top: 0 }

  const order: RouteId[] = selected === "clean" ? ["fast", "clean"] : ["clean", "fast"]

  return (
    <div
      ref={containerRef}
      className="map"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <svg
        className="map-svg"
        viewBox={viewBox}
        preserveAspectRatio={size ? "none" : "xMidYMid slice"}
        role="img"
        aria-label={label}
      >
        <rect x={-3000} y={-3000} width={7200} height={6800} fill="var(--land)" />
        <path
          d="M-3000 640L0 640C200 600 420 700 640 660S1000 600 1200 650L4200 650L4200 3800L-3000 3800Z"
          fill="var(--water)"
        />
        <rect x={170} y={130} width={230} height={170} rx={18} fill="var(--park)" />
        <rect x={800} y={400} width={210} height={140} rx={18} fill="var(--park)" />
        <g stroke="var(--road)" strokeWidth={7} strokeLinecap="round">
          {[100, 220, 340, 460, 560].map((y) => (
            <line key={`h${y}`} x1={0} y1={y} x2={MAP_W} y2={y} />
          ))}
          {[100, 260, 420, 580, 740, 900, 1060].map((x) => (
            <line key={`v${x}`} x1={x} y1={0} x2={x} y2={640} />
          ))}
        </g>
        <path d="M0 520L1200 250" stroke="var(--road2)" strokeWidth={22} />
        <path d="M0 520L1200 250" stroke="var(--road)" strokeWidth={16} />
        <g className="map-label" fontSize={13} fill="var(--muted)">
          <text x={205} y={220}>
            Parc La Fontaine
          </text>
          <text x={820} y={478}>
            Parc Jeanne-Mance
          </text>
          <text x={520} y={740} fontStyle="italic">
            Fleuve Saint-Laurent
          </text>
          <text transform={`translate(150 508) rotate(${BUSY_ANGLE})`}>Rue Notre-Dame, truck route</text>
        </g>

        {routes && (
          <g key={routeKey} className="routes">
            {order.map((id) => {
              const route = routes[id]
              const d = toPath(route.points)
              const isSelected = id === selected
              const color = id === "fast" ? "var(--fast)" : "var(--clean)"
              return (
                <g key={id} className={isSelected ? "route is-selected" : "route"}>
                  <path
                    className="route-draw"
                    d={d}
                    pathLength={1}
                    fill="none"
                    stroke="var(--road)"
                    strokeWidth={13 * k}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    className="route-draw"
                    d={d}
                    pathLength={1}
                    fill="none"
                    stroke={color}
                    strokeOpacity={isSelected ? 1 : 0.75}
                    strokeWidth={(isSelected ? 7 : 4) * k}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    className="route-hit"
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={22 * k}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    onClick={() => select(id)}
                  >
                    <title>{`${route.name} route, ${route.minutes} min`}</title>
                  </path>
                </g>
              )
            })}
          </g>
        )}

        {routes && start && (
          <g transform={`translate(${start.x} ${start.y}) scale(${k})`}>
            <circle r={8} fill="var(--surface)" stroke="var(--pop)" strokeWidth={3.5} />
          </g>
        )}

        {destination && (
          <g transform={`translate(${destination.x} ${destination.y}) scale(${k})`}>
            <path
              d="M0 0C-4 -9 -15 -16 -15 -27A15 15 0 1 1 15 -27C15 -16 4 -9 0 0Z"
              fill="var(--pop)"
              stroke="var(--surface)"
              strokeWidth={1.5}
            />
            <circle cy={-27} r={5.5} fill="#fff" />
          </g>
        )}

        <g transform={`translate(${currentLocation.x} ${currentLocation.y}) scale(${k})`}>
          <ellipse cx={0} cy={1} rx={11} ry={4} fill="rgba(0,0,0,.22)" />
          <g transform="scale(0.62) translate(-40 -76)">
            <path d={PIN_PATH} fill="var(--pin)" stroke="#fff" strokeWidth={6.5} paintOrder="stroke" strokeLinejoin="round" />
            <path d={LEAF_PATH} fill="var(--leaf)" />
            <path d={VEIN_PATH} stroke="var(--pin)" strokeWidth={2.5} strokeLinecap="round" />
          </g>
        </g>
      </svg>

      {routes && size && (
        <div key={routeKey} className="bubbles">
          {(["fast", "clean"] as RouteId[]).map((id) => {
            const route = routes[id]
            const mid = pointAlong(route.points, 0.5)
            const pos = toScreen(mid)
            const isSelected = id === selected
            return (
              <button
                key={id}
                type="button"
                className={`bubble bubble-${id}${isSelected ? " is-selected" : ""}`}
                style={{ left: pos.left, top: pos.top }}
                aria-pressed={isSelected}
                onClick={() => select(id)}
              >
                {route.bubble} {route.minutes} min
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
