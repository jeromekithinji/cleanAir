"use client"

import { useEffect, useRef } from "react"
import {
  GeoJSONSource,
  LngLatBounds,
  Map,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import type { Place, RouteOption } from "@/lib/types"

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty"
const MONTREAL: [number, number] = [-73.59, 45.52]

interface RouteMapProps {
  origin: Place | null
  destination: Place | null
  userLocation: Place | null
  routes: RouteOption[]
  selectedId: "fast" | "clean" | null
  onSelect: (id: "fast" | "clean") => void
}

function cameraPadding(map: Map) {
  const height = map.getContainer().clientHeight || 1
  const width = map.getContainer().clientWidth || 1
  const topWanted = 320
  const bottomWanted = 48
  const maxY = Math.max(80, height - 80)
  const maxX = Math.max(32, width - 32)
  const vertical = topWanted + bottomWanted
  const scale = vertical > maxY ? maxY / vertical : 1
  const side = Math.min(48, Math.floor(maxX / 4))
  return {
    top: Math.floor(topWanted * scale),
    bottom: Math.floor(bottomWanted * scale),
    left: side,
    right: side,
  }
}

function sameSpot(a: Place, b: Place): boolean {
  return Math.abs(a.lat - b.lat) < 0.0004 && Math.abs(a.lon - b.lon) < 0.0004
}

function userLocationElement(): HTMLDivElement {
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
  dot.style.boxShadow = "0 0 0 1px rgba(26,115,232,0.35)"
  wrap.appendChild(dot)
  return wrap
}

function startMarkerElement(): HTMLDivElement {
  const el = document.createElement("div")
  el.style.width = "16px"
  el.style.height = "16px"
  el.style.borderRadius = "50%"
  el.style.background = "#fff"
  el.style.border = "2px solid #202124"
  el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.35)"
  return el
}

export function RouteMap({
  origin,
  destination,
  userLocation,
  routes,
  selectedId,
  onSelect,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const markersRef = useRef<Marker[]>([])
  const userMarkerRef = useRef<Marker | null>(null)
  const onSelectRef = useRef(onSelect)
  const fittedKey = useRef("")
  const didCenterOnUser = useRef(false)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    setWorkerUrl("/maplibre-gl-worker.mjs")
    const map = new Map({
      container,
      style: MAP_STYLE,
      center: MONTREAL,
      zoom: 11.4,
    })
    map.addControl(
      new NavigationControl({ showCompass: false }),
      "bottom-right",
    )

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
    observer.observe(container)
    return () => {
      observer.disconnect()
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      userMarkerRef.current?.remove()
      userMarkerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !userLocation) {
      return
    }

    let cancelled = false
    const show = () => {
      if (cancelled) {
        return
      }
      const lngLat: [number, number] = [userLocation.lon, userLocation.lat]
      if (!userMarkerRef.current) {
        userMarkerRef.current = new Marker({
          element: userLocationElement(),
        })
          .setLngLat(lngLat)
          .addTo(map)
      } else {
        userMarkerRef.current.setLngLat(lngLat)
      }
      if (!didCenterOnUser.current && !destination) {
        didCenterOnUser.current = true
        map.easeTo({
          center: lngLat,
          zoom: 14,
          padding: { top: 0, bottom: 0, left: 0, right: 0 },
          duration: 800,
        })
      }
    }

    if (map.isStyleLoaded()) {
      show()
    } else {
      map.once("load", show)
    }
    return () => {
      cancelled = true
      map.off("load", show)
    }
  }, [userLocation, destination])

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
      ;(source as GeoJSONSource).setData({
        type: "FeatureCollection",
        features: routes.map((route) => {
          const selected = route.id === selectedId
          const clean = route.id === "clean"
          return {
            type: "Feature" as const,
            properties: {
              id: route.id,
              rank: selected ? 2 : 1,
              color: clean ? "#0b8043" : "#1a73e8",
              width: selected ? 7 : 5,
              opacity: selected ? 1 : 0.45,
            },
            geometry: route.geometry,
          }
        }),
      })

      markersRef.current.forEach((marker) => marker.remove())
      const next: Marker[] = []
      const originIsUser =
        origin !== null &&
        userLocation !== null &&
        sameSpot(origin, userLocation)
      const destinationIsUser =
        destination !== null &&
        userLocation !== null &&
        sameSpot(destination, userLocation)
      if (origin && !originIsUser) {
        next.push(
          new Marker({ element: startMarkerElement() })
            .setLngLat([origin.lon, origin.lat])
            .addTo(map),
        )
      }
      if (destination && !destinationIsUser) {
        next.push(
          new Marker({ color: "#d93025" })
            .setLngLat([destination.lon, destination.lat])
            .addTo(map),
        )
      }
      markersRef.current = next

      const fitKey = `${origin?.label ?? ""}:${destination?.label ?? ""}`
      if (destination && origin && fittedKey.current !== fitKey) {
        const bounds = new LngLatBounds()
        bounds.extend([origin.lon, origin.lat])
        bounds.extend([destination.lon, destination.lat])
        routes.forEach((route) => {
          route.geometry.coordinates.forEach((pair) => {
            const lon = pair[0]
            const lat = pair[1]
            if (lon !== undefined && lat !== undefined) {
              bounds.extend([lon, lat])
            }
          })
        })
        map.fitBounds(bounds, {
          padding: cameraPadding(map),
          absolutePadding: true,
          maxZoom: 15,
          duration: 700,
        })
        fittedKey.current = fitKey
      }

      if (!destination && fittedKey.current) {
        fittedKey.current = ""
        const center: [number, number] = userLocation
          ? [userLocation.lon, userLocation.lat]
          : MONTREAL
        map.easeTo({
          center,
          zoom: userLocation ? 14 : 11.4,
          padding: { top: 0, bottom: 0, left: 0, right: 0 },
          duration: 600,
        })
      }
    }

    if (map.isStyleLoaded() && map.getSource("routes")) {
      draw()
      return
    }
    map.once("load", draw)
  }, [origin, destination, userLocation, routes, selectedId])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ position: "absolute", inset: 0 }}
    />
  )
}
