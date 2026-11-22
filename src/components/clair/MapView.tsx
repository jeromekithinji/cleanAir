"use client"

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react"
import { GeoJSONSource, LngLatBounds, Map, Marker, setWorkerUrl } from "maplibre-gl"
import type { ExpressionSpecification, FilterSpecification } from "@maplibre/maplibre-gl-style-spec"
import "maplibre-gl/dist/maplibre-gl.css"
import { PLACES, type Place, type Point } from "@/data/mock"
import type { HeatGrid } from "@/lib/heat-grid"
import { formatMinutes, type RouteId, type RoutePair } from "@/lib/routing"

export type Insets = { top: number; right: number; bottom: number; left: number }

export type MapViewHandle = {
  zoomBy: (factor: number) => void
  flyTo: (point: Point, zoom?: number) => void
  /** minZoom is kept so the existing caller still typechecks. */
  fitPoints: (points: Point[], padding: Insets, minZoom?: number) => void
  fitCoordinates: (coordinates: LngLat[], padding: Insets) => void
  reset: () => void
  locate: () => void
}

export type MapViewProps = {
  ref?: Ref<MapViewHandle>
  routes: RoutePair | null
  routeKey: string
  selected: RouteId
  onSelectRoute: (id: RouteId) => void
  start: Place | null
  destination: Place | null
  currentLocation: Point
  label: string
  /** Exposure map: busy roads glow red, heat layer underneath. */
  exposureOn: boolean
  heat: HeatGrid | null
}

type LngLat = [number, number]
type Gps = { lat: number; lon: number }

const STYLE = "https://tiles.openfreemap.org/styles/liberty"
const MONTREAL: LngLat = [-73.59, 45.52]
const FAST = "#1a73e8"
const CLEAN = "#1B7A62"

function anchor(place: Place, gps: Gps | null): Gps {
  if (place.id === "current" && gps) {
    return gps
  }
  return { lat: place.lat, lon: place.lon }
}

function project(point: Point, start: Place, end: Place, gps: Gps | null): LngLat {
  const origin = anchor(start, gps)
  const dx = end.x - start.x
  const dy = end.y - start.y
  const len2 = dx * dx + dy * dy
  if (len2 < 1) {
    return [origin.lon, origin.lat]
  }
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / len2
  const cross = (point.x - start.x) * dy - (point.y - start.y) * dx
  const fakeLen = Math.sqrt(len2)
  const realDx = end.lon - origin.lon
  const realDy = end.lat - origin.lat
  const realLen = Math.hypot(realDx, realDy) || 0.0001
  const scale = realLen / fakeLen
  return [
    origin.lon + t * realDx + (-realDy / realLen) * (cross / fakeLen) * scale,
    origin.lat + t * realDy + (realDx / realLen) * (cross / fakeLen) * scale,
  ]
}

function routeLine(route: RoutePair[RouteId], start: Place, end: Place, gps: Gps | null): LngLat[] {
  if (route.coordinates && route.coordinates.length > 1) {
    return route.coordinates
  }
  return route.points.map((point) => project(point, start, end, gps))
}

function knownLngLat(point: Point, gps: Gps | null): LngLat | null {
  const place = PLACES.find((item) => Math.hypot(item.x - point.x, item.y - point.y) < 1)
  if (!place) {
    return null
  }
  const spot = anchor(place, gps)
  return [spot.lon, spot.lat]
}

function userDot(): HTMLDivElement {
  const wrap = document.createElement("div")
  wrap.title = "Your location"
  wrap.style.width = "22px"
  wrap.style.height = "22px"
  wrap.style.borderRadius = "50%"
  wrap.style.background = "rgba(26,115,232,0.28)"
  wrap.style.display = "grid"
  wrap.style.placeItems = "center"
  const dot = document.createElement("div")
  dot.style.width = "14px"
  dot.style.height = "14px"
  dot.style.borderRadius = "50%"
  dot.style.background = "#1a73e8"
  dot.style.border = "2px solid #fff"
  wrap.appendChild(dot)
  return wrap
}

// ---------- Exposure map ----------

const EXPOSURE_LAYERS = ["exposure-heat", "exposure-roads-glow", "exposure-roads"]
/**
 * The road types routing.py counts as busy, coloured from highway to secondary.
 * Most Montréal arterials are secondary, so those stay thin and faint and only
 * highways and main roads glow; otherwise the whole street grid turns red.
 */
const BUSY_CLASSES = ["motorway", "trunk", "primary", "secondary"]
const GLOW_CLASSES = ["motorway", "trunk", "primary"]
const ROAD_COLOR: ExpressionSpecification = [
  "match",
  ["get", "class"],
  ["motorway", "trunk"],
  "#B42324",
  "primary",
  "#E24B4A",
  "#F08A5D",
]
/** One slow breath of the red glow, in ms. */
const PULSE_MS = 2600

function addExposureLayers(map: Map) {
  // Under the first label layer, so street names stay readable. The routes are
  // added after the style loads, so they stay on top of all of this.
  const beforeId = map.getStyle().layers.find((layer) => layer.type === "symbol")?.id
  map.addSource("exposure-heat", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  })
  map.addLayer(
    {
      id: "exposure-heat",
      type: "heatmap",
      source: "exposure-heat",
      layout: { visibility: "none" },
      paint: {
        "heatmap-weight": ["coalesce", ["get", "weight"], 0],
        "heatmap-intensity": 1.1,
        // Grid points are ~3.5 km apart: grow the radius with zoom so they blend.
        "heatmap-radius": ["interpolate", ["exponential", 2], ["zoom"], 9, 22, 11, 90, 13, 360, 15, 1440],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(251, 191, 36, 0)",
          0.15,
          "rgba(251, 191, 36, 0.35)",
          0.4,
          "rgba(245, 158, 11, 0.55)",
          0.7,
          "rgba(226, 75, 74, 0.7)",
          1,
          "rgba(180, 35, 36, 0.8)",
        ],
        "heatmap-opacity": 0.55,
      },
    },
    beforeId,
  )
  const roadFilter = (classes: string[]): FilterSpecification => [
    "all",
    ["match", ["get", "class"], classes, true, false],
    ["!=", ["get", "brunnel"], "tunnel"],
  ]
  map.addLayer(
    {
      id: "exposure-roads-glow",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      filter: roadFilter(GLOW_CLASSES),
      layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ROAD_COLOR,
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 4, 13, 9, 16, 20],
        "line-blur": ["interpolate", ["linear"], ["zoom"], 10, 3, 16, 10],
        "line-opacity": 0.3,
      },
    },
    beforeId,
  )
  map.addLayer(
    {
      id: "exposure-roads",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      filter: roadFilter(BUSY_CLASSES),
      layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ROAD_COLOR,
        // Secondary roads: thinner and fainter than highways and main roads.
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          ["match", ["get", "class"], "secondary", 0.6, 1.6],
          13,
          ["match", ["get", "class"], "secondary", 1.4, 3.5],
          16,
          ["match", ["get", "class"], "secondary", 3, 7],
        ],
        "line-opacity": ["match", ["get", "class"], "secondary", 0.45, 0.85],
      },
    },
    beforeId,
  )
}

/**
 * Heat data for the layer. Each point's weight is where it sits between the
 * coolest and warmest point. The coolest 30% count for nothing, so only the
 * warmer areas glow (the grid is even, so equal weights would just tint the
 * whole city). The whole layer is fainter on cool days and stronger on hot ones.
 */
function heatLayerData(heat: HeatGrid): { data: GeoJSON.FeatureCollection; opacity: number } {
  const min = heat.minC ?? 0
  const max = heat.maxC ?? 0
  const spread = Math.max(1, max - min)
  const features = heat.points.features.map((feature) => {
    const t = (feature.properties.feels - min) / spread
    return { ...feature, properties: { ...feature.properties, weight: Math.max(0, (t - 0.3) / 0.7) } }
  })
  // 10 °C or less: faint (0.6). 35 °C or more: strong (0.95).
  const strength = Math.max(0, Math.min(1, (max - 10) / 25))
  return { data: { type: "FeatureCollection", features }, opacity: 0.6 + 0.35 * strength }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function clampPadding(map: Map, pad: Insets): Insets {
  const height = map.getContainer().clientHeight || 1
  const width = map.getContainer().clientWidth || 1
  const maxY = Math.max(48, height - 80)
  const maxX = Math.max(48, width - 80)
  const scaleY = pad.top + pad.bottom > maxY ? maxY / (pad.top + pad.bottom) : 1
  const scaleX = pad.left + pad.right > maxX ? maxX / (pad.left + pad.right) : 1
  return {
    top: Math.floor(pad.top * scaleY),
    bottom: Math.floor(pad.bottom * scaleY),
    left: Math.floor(pad.left * scaleX),
    right: Math.floor(pad.right * scaleX),
  }
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
  exposureOn,
  heat,
}: MapViewProps) {
  const mapNodeRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const gpsRef = useRef<Gps | null>(null)
  const destinationRef = useRef(destination)
  destinationRef.current = destination
  const userMarkerRef = useRef<Marker | null>(null)
  const pinMarkerRef = useRef<Marker | null>(null)
  const onSelectRef = useRef(onSelectRoute)
  /** Set once the exposure layers exist; the load handler re-applies the toggle. */
  const exposureReady = useRef(false)
  const applyExposureRef = useRef<() => void>(() => undefined)
  const [gps, setGps] = useState<Gps | null>(null)
  const [bubbles, setBubbles] = useState<Array<{ id: RouteId; left: number; top: number; text: string }>>([])

  useEffect(() => {
    onSelectRef.current = onSelectRoute
  }, [onSelectRoute])

  useEffect(() => {
    const node = mapNodeRef.current
    if (!node) {
      return
    }
    setWorkerUrl("/maplibre-gl-worker.mjs")
    const map = new Map({
      container: node,
      style: STYLE,
      center: MONTREAL,
      zoom: 11.4,
    })
    map.on("load", () => {
      map.resize()
      addExposureLayers(map)
      exposureReady.current = true
      applyExposureRef.current()
      map.addSource("routes", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      })
      map.addLayer({
        id: "routes",
        type: "line",
        source: "routes",
        layout: {
          "line-cap": "round",
          "line-join": "round",
          "line-sort-key": ["get", "rank"],
        },
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["get", "width"],
          "line-opacity": ["get", "opacity"],
        },
      })
      map.on("click", "routes", (event) => {
        const id = event.features?.[0]?.properties?.id
        if (id === "fast" || id === "clean") {
          onSelectRef.current(id)
        }
      })
      map.on("mouseenter", "routes", () => {
        map.getCanvas().style.cursor = "pointer"
      })
      map.on("mouseleave", "routes", () => {
        map.getCanvas().style.cursor = ""
      })
    })
    mapRef.current = map
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(node)
    return () => {
      observer.disconnect()
      userMarkerRef.current?.remove()
      pinMarkerRef.current?.remove()
      userMarkerRef.current = null
      pinMarkerRef.current = null
      exposureReady.current = false
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Exposure map: show or hide the layers, load the heat data, run the pulse.
  useEffect(() => {
    let frame = 0
    const apply = () => {
      const map = mapRef.current
      if (!map || !exposureReady.current) {
        return
      }
      const visibility = exposureOn ? "visible" : "none"
      for (const id of EXPOSURE_LAYERS) {
        map.setLayoutProperty(id, "visibility", visibility)
      }
      if (heat) {
        const { data, opacity } = heatLayerData(heat)
        ;(map.getSource("exposure-heat") as GeoJSONSource | undefined)?.setData(data)
        // Lighter at street zoom, where the 3.5 km grid has no detail to show.
        map.setPaintProperty("exposure-heat", "heatmap-opacity", [
          "interpolate",
          ["linear"],
          ["zoom"],
          12,
          opacity,
          15,
          opacity * 0.45,
        ])
      }
      cancelAnimationFrame(frame)
      if (!exposureOn || prefersReducedMotion()) {
        map.setPaintProperty("exposure-roads-glow", "line-opacity", 0.3)
        return
      }
      // Slow breathing glow on the busy roads: the "red wave".
      let last = 0
      const pulse = (now: number) => {
        if (now - last > 50) {
          last = now
          const wave = (1 - Math.cos((2 * Math.PI * now) / PULSE_MS)) / 2
          map.setPaintProperty("exposure-roads-glow", "line-opacity", 0.12 + 0.4 * wave)
        }
        frame = requestAnimationFrame(pulse)
      }
      frame = requestAnimationFrame(pulse)
    }
    applyExposureRef.current = apply
    apply()
    return () => cancelAnimationFrame(frame)
  }, [exposureOn, heat])

  useEffect(() => {
    if (!navigator.geolocation) {
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lon: position.coords.longitude }
        gpsRef.current = next
        setGps(next)
        const map = mapRef.current
        if (map && !destinationRef.current) {
          map.easeTo({
            center: [next.lon, next.lat],
            zoom: 14,
            padding: { top: 0, bottom: 0, left: 0, right: 0 },
            duration: 800,
          })
        }
      },
      () => undefined,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    )
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !gps) {
      return
    }
    const show = () => {
      const lngLat: LngLat = [gps.lon, gps.lat]
      if (!userMarkerRef.current) {
        userMarkerRef.current = new Marker({ element: userDot() }).setLngLat(lngLat).addTo(map)
      } else {
        userMarkerRef.current.setLngLat(lngLat)
      }
    }
    if (map.isStyleLoaded()) {
      show()
    } else {
      map.once("load", show)
    }
  }, [gps])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }
    const draw = () => {
      const source = map.getSource("routes")
      if (!source || source.type !== "geojson") {
        return
      }
      const features =
        routes && start && destination
          ? (["fast", "clean"] as RouteId[]).map((id) => {
              const route = routes[id]
              const active = id === selected
              return {
                type: "Feature" as const,
                properties: {
                  id,
                  rank: active ? 2 : 1,
                  color: id === "clean" ? CLEAN : FAST,
                  width: active ? 7 : 5,
                  opacity: active ? 1 : 0.55,
                },
                geometry: {
                  type: "LineString" as const,
                  coordinates: routeLine(route, start, destination, gps),
                },
              }
            })
          : []
      ;(source as GeoJSONSource).setData({ type: "FeatureCollection", features })

      pinMarkerRef.current?.remove()
      pinMarkerRef.current = null
      if (destination) {
        pinMarkerRef.current = new Marker({ color: "#d93025" })
          .setLngLat([destination.lon, destination.lat])
          .addTo(map)
      }
    }
    if (map.isStyleLoaded() && map.getSource("routes")) {
      draw()
      return
    }
    map.once("load", draw)
  }, [routes, start, destination, selected, gps, routeKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }
    const place = () => {
      if (!routes || !start || !destination) {
        setBubbles([])
        return
      }
      setBubbles(
        (["fast", "clean"] as RouteId[]).map((id) => {
          const route = routes[id]
          const line = routeLine(route, start, destination, gps)
          const mid = line[Math.floor(line.length / 2)] ?? line[0]
          if (!mid) {
            return { id, left: 0, top: 0, text: `${route.bubble} ${formatMinutes(route.minutes)}` }
          }
          const pos = map.project(mid)
          return { id, left: pos.x, top: pos.y, text: `${route.bubble} ${formatMinutes(route.minutes)}` }
        }),
      )
    }
    place()
    map.on("move", place)
    return () => {
      map.off("move", place)
    }
  }, [routes, start, destination, gps, routeKey])

  useImperativeHandle(
    ref,
    () => ({
      zoomBy(factor) {
        const map = mapRef.current
        if (!map) {
          return
        }
        map.easeTo({ zoom: map.getZoom() + Math.log2(factor), duration: 250 })
      },
      flyTo(point, zoom = 2) {
        const map = mapRef.current
        if (!map) {
          return
        }
        const center = knownLngLat(point, gpsRef.current) ?? MONTREAL
        map.easeTo({
          center,
          zoom: zoom >= 2 ? 15 : 13,
          padding: { top: 0, bottom: 0, left: 0, right: 0 },
          duration: 700,
        })
      },
      fitPoints(points, pad) {
        const map = mapRef.current
        if (!map || !start || !destination || points.length === 0) {
          return
        }
        const bounds = new LngLatBounds()
        points.forEach((point) => bounds.extend(project(point, start, destination, gpsRef.current)))
        map.fitBounds(bounds, {
          padding: clampPadding(map, pad),
          absolutePadding: true,
          maxZoom: 15,
          duration: 700,
        })
      },
      fitCoordinates(coordinates, pad) {
        const map = mapRef.current
        if (!map || coordinates.length === 0) {
          return
        }
        const bounds = new LngLatBounds()
        coordinates.forEach((lngLat) => bounds.extend(lngLat))
        map.fitBounds(bounds, {
          padding: clampPadding(map, pad),
          absolutePadding: true,
          maxZoom: 15,
          duration: 700,
        })
      },
      reset() {
        const map = mapRef.current
        if (!map) {
          return
        }
        const gpsNow = gpsRef.current
        map.easeTo({
          center: gpsNow ? [gpsNow.lon, gpsNow.lat] : MONTREAL,
          zoom: gpsNow ? 14 : 11.4,
          padding: { top: 0, bottom: 0, left: 0, right: 0 },
          duration: 600,
        })
      },
      locate() {
        const map = mapRef.current
        if (!map) {
          return
        }
        const gpsNow = gpsRef.current
        const center = gpsNow
          ? [gpsNow.lon, gpsNow.lat]
          : knownLngLat(currentLocation, null) ?? MONTREAL
        map.easeTo({
          center: center as LngLat,
          zoom: 15,
          padding: { top: 0, bottom: 0, left: 0, right: 0 },
          duration: 700,
        })
      },
    }),
    [start, destination, currentLocation],
  )

  return (
    <div className="map map-real" role="application" aria-label={label}>
      <div ref={mapNodeRef} className="map-canvas" />
      <div className="bubbles">
        {bubbles.map((bubble) => (
          <button
            key={bubble.id}
            type="button"
            className={`bubble bubble-${bubble.id}${bubble.id === selected ? " is-selected" : ""}`}
            style={{ left: bubble.left, top: bubble.top }}
            aria-pressed={bubble.id === selected}
            onClick={() => onSelectRoute(bubble.id)}
          >
            {bubble.text}
          </button>
        ))}
      </div>
    </div>
  )
}
