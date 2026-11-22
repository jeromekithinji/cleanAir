"use client"

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react"
import { GeoJSONSource, LngLatBounds, Map, Marker, setWorkerUrl } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { PLACES, type Place, type Point } from "@/data/mock"
import { pointAlong, type RouteId, type RoutePair } from "@/lib/routing"

export type Insets = { top: number; right: number; bottom: number; left: number }

export type MapViewHandle = {
  zoomBy: (factor: number) => void
  flyTo: (point: Point, zoom?: number) => void
  /** minZoom is kept so the existing caller still typechecks. */
  fitPoints: (points: Point[], padding: Insets, minZoom?: number) => void
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
}: MapViewProps) {
  const mapNodeRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const gpsRef = useRef<Gps | null>(null)
  const destinationRef = useRef(destination)
  destinationRef.current = destination
  const userMarkerRef = useRef<Marker | null>(null)
  const pinMarkerRef = useRef<Marker | null>(null)
  const onSelectRef = useRef(onSelectRoute)
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
      map.remove()
      mapRef.current = null
    }
  }, [])

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
                  coordinates: route.points.map((point) => project(point, start, destination, gps)),
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
          const mid = pointAlong(route.points, 0.5)
          const pos = map.project(project(mid, start, destination, gps))
          return { id, left: pos.x, top: pos.y, text: `${route.bubble} ${route.minutes} min` }
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
