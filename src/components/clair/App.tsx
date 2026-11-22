"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import {
  CURRENT_LOCATION,
  EMPTY_HEALTH,
  levelForIndex,
  placeById,
  type Health,
  type Level,
  type Mode,
  type Place,
  type Scenario,
} from "@/data/mock"
import { planHealthRoutes } from "@/lib/api"
import { placeAt } from "@/lib/geocode-place"
import type { HeatGrid } from "@/lib/heat-grid"
import { SAMPLE_PLACES } from "@/lib/sample-trip"
import { toScenario, type LiveConditions } from "@/lib/live-view"
import {
  replyText,
  type AssistantHint,
  type AssistantReply as GroqReply,
  type AssistantTrip,
} from "@/lib/assistant-types"
import { answerMessage } from "@/lib/clair-assistant"
import { addTrip } from "@/lib/account"
import { greetingReply } from "@/lib/greeting"
import { kgSaved } from "@/lib/impact"
import { formatMinutes, pairFromResponse, type RouteId, type RoutePair } from "@/lib/routing"
import type { Sensitivity } from "@/lib/types"
import { AirQualityCard } from "./AirQualityCard"
import { ChatAssistant, type ChatMessage } from "./ChatAssistant"
import { DirectionsPanel } from "./DirectionsPanel"
import { ExposureCard } from "./ExposureCard"
import { HealthForm } from "./HealthForm"
import { ImpactCard } from "./ImpactCard"
import { MapControls } from "./MapControls"
import { MapView, type Insets, type MapViewHandle } from "./MapView"
import { Modal } from "./Modal"
import { TopBar } from "./TopBar"
import { WeatherCard } from "./WeatherCard"
import { WelcomeSheet } from "./WelcomeSheet"

type ModalState = "welcome" | "health" | "impact" | null

type Trip = { mode: Mode; km: number; route: RouteId; kg: number }

const PHONE_QUERY = "(max-width: 700px)"

function subscribePhone(onChange: () => void) {
  const media = window.matchMedia(PHONE_QUERY)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

const EMPTY_SCENARIO: Scenario = {
  id: 0,
  index: 0,
  pollutant: "—",
  previous: 0,
  temp: 0,
  feels: 0,
  sky: "—",
  wind: 0,
  best: "—",
  heatWarning: false,
}

const MONTREAL = { lat: 45.50884, lon: -73.58781 }

function sensitivity(level: Level | null): Sensitivity {
  if (level === 3) {
    return "high"
  }
  if (level === 2) {
    return "medium"
  }
  return "low"
}

function sensitivityOrNull(level: Level | null): Sensitivity | null {
  if (level === 3) {
    return "high"
  }
  if (level === 2) {
    return "medium"
  }
  if (level === 1) {
    return "low"
  }
  return null
}

function sameSpot(a: Place, b: Place): boolean {
  return Math.abs(a.lat - b.lat) < 0.00005 && Math.abs(a.lon - b.lon) < 0.00005
}

function nearestPlaces(lat: number, lon: number): string[] {
  return [...SAMPLE_PLACES]
    .map((place) => ({
      label: place.label,
      km: distanceKm(lat, lon, place.lat, place.lon),
    }))
    .filter((place) => place.km > 0.3)
    .sort((a, b) => a.km - b.km)
    .slice(0, 3)
    .map((place) => place.label)
}

function distanceKm(lat: number, lon: number, otherLat: number, otherLon: number): number {
  const toRad = (degrees: number) => degrees * Math.PI / 180
  const dLat = toRad(otherLat - lat)
  const dLon = toRad(otherLon - lon)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat)) * Math.cos(toRad(otherLat)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)))
}

const GREETING: ChatMessage = {
  id: 0,
  role: "assistant",
  text: "Hi, I can plan a cleaner-air trip for you. Where are you going, and how will you get there?",
}

export function App() {
  const mapRef = useRef<MapViewHandle>(null)
  const panelRef = useRef<HTMLElement>(null)
  const nextId = useRef(1)
  const chatBusyRef = useRef(false)
  const livePoint = useRef(MONTREAL)
  const gpsPlace = useRef<Place | null>(null)
  const startChosen = useRef(false)

  const [modal, setModal] = useState<ModalState>("welcome")
  const [welcomeDone, setWelcomeDone] = useState(false)
  const [health, setHealth] = useState<Health>(EMPTY_HEALTH)
  const routeMeta = useRef({
    tunedFor: [] as string[],
    advisory: null as string | null,
    healthCost: null as number | null,
    busyMinutes: null as { fast: number; clean: number } | null,
    shadePct: null as { fast: number | null; clean: number | null } | null,
  })
  const [live, setLive] = useState<LiveConditions | null>(null)
  const [mode, setMode] = useState<Mode>("walk")

  const [start, setStart] = useState<Place | null>(null)
  const [dest, setDest] = useState<Place | null>(null)
  const [startText, setStartText] = useState("")
  const [locating, setLocating] = useState(true)
  const [locationMessage, setLocationMessage] = useState<string | null>(null)
  const [destText, setDestText] = useState("")
  const [twoFields, setTwoFields] = useState(false)
  const [swapped, setSwapped] = useState(false)

  const [routes, setRoutes] = useState<RoutePair | null>(null)
  const [tradeoff, setTradeoff] = useState("")
  const [explanations, setExplanations] = useState<string[]>([])
  const [suggestMetro, setSuggestMetro] = useState(false)
  const [routesLoading, setRoutesLoading] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [selected, setSelected] = useState<RouteId>("clean")
  const [tripActive, setTripActive] = useState(false)
  const [trip, setTrip] = useState<Trip | null>(null)
  const [sessionKg, setSessionKg] = useState(0)

  const [airOpen, setAirOpen] = useState(true)
  const [weatherOpen, setWeatherOpen] = useState(true)
  const [exposureOn, setExposureOn] = useState(false)
  const [exposureOpen, setExposureOpen] = useState(true)
  const [heat, setHeat] = useState<HeatGrid | null>(null)
  const isPhone = useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  )
  const [phoneSeen, setPhoneSeen] = useState(false)
  const [lastRouteKey, setLastRouteKey] = useState("")
  const [chatOpen, setChatOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING])
  const [chatBusy, setChatBusy] = useState(false)

  const scenario = live ? toScenario(live) : EMPTY_SCENARIO
  const airKnown = live?.index != null
  const airLevel = airKnown ? levelForIndex(scenario.index) : "unknown"

  const routeKey = routes
    ? `${routes.fast.minutes}|${routes.fast.km}|${routes.clean.minutes}|${routes.clean.km}|${routes.fast.coordinates?.length ?? 0}`
    : ""
  const panelVisible = dest !== null || (twoFields && swapped && start === null)
  const panelTop = twoFields ? 134 : 70

  // Phone layout: widgets start collapsed.
  if (isPhone && !phoneSeen) {
    setPhoneSeen(true)
    setAirOpen(false)
    setWeatherOpen(false)
  }

  // A new pair of routes collapses both widgets.
  if (routeKey !== lastRouteKey) {
    setLastRouteKey(routeKey)
    if (routeKey) {
      setAirOpen(false)
      setWeatherOpen(false)
      setExposureOpen(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const load = (lat: number, lon: number) => {
      livePoint.current = { lat, lon }
      const params = new URLSearchParams({ lat: String(lat), lon: String(lon) })
      fetch(`/api/live?${params.toString()}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((data: LiveConditions | null) => {
          if (!cancelled && data) {
            setLive(data)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLive(null)
          }
        })
    }
    const useHere = (lat: number, lon: number) => {
      const place = placeAt("Your location", lon, lat, "Current position", "your-location")
      gpsPlace.current = place
      if (!cancelled && !startChosen.current) {
        setStart(place)
        setStartText(place.name)
        setLocationMessage(null)
      }
    }
    if (!navigator.geolocation) {
      if (!cancelled) {
        setLocating(false)
        setLocationMessage("Location is unavailable. Choose a starting point.")
      }
      load(MONTREAL.lat, MONTREAL.lon)
      return () => {
        cancelled = true
      }
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        useHere(position.coords.latitude, position.coords.longitude)
        if (!cancelled) {
          setLocating(false)
        }
        load(position.coords.latitude, position.coords.longitude)
      },
      () => {
        if (!cancelled && !startChosen.current) {
          setLocationMessage("Location is unavailable. Choose a starting point.")
        }
        if (!cancelled) {
          setLocating(false)
        }
        load(MONTREAL.lat, MONTREAL.lon)
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    )
    return () => {
      cancelled = true
    }
  }, [])

  // Readings loaded before the weather timestamp existed have no line to show.
  useEffect(() => {
    if (!live || live.weatherUpdatedLabel) {
      return
    }
    const params = new URLSearchParams({
      lat: String(livePoint.current.lat),
      lon: String(livePoint.current.lon),
    })
    let cancelled = false
    fetch(`/api/live?${params.toString()}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: LiveConditions | null) => {
        if (!cancelled && data?.weatherUpdatedLabel) {
          setLive(data)
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [live])

  // Exposure map: load the heat grid the first time it is turned on.
  useEffect(() => {
    if (!exposureOn || heat) {
      return
    }
    let cancelled = false
    fetch("/api/heat")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: HeatGrid | null) => {
        if (!cancelled && data?.points) {
          setHeat(data)
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [exposureOn, heat])

  const fitInsets = useCallback((): Insets => {
    if (isPhone) {
      const panel = panelRef.current
      const bottomOfPanel = panel ? panel.getBoundingClientRect().bottom : panelTop
      return { top: bottomOfPanel + 24, right: 24, bottom: 24, left: 24 }
    }
    return { top: 66, right: 156, bottom: 66, left: 12 + 456 + 24 }
  }, [isPhone, panelTop])

  useEffect(() => {
    if (!start || !dest || sameSpot(start, dest)) {
      setRoutes(null)
      setTradeoff("")
      setExplanations([])
      setSuggestMetro(false)
      setRouteError(null)
      setRoutesLoading(false)
      routeMeta.current = {
        tunedFor: [],
        advisory: null,
        healthCost: null,
        busyMinutes: null,
        shadePct: null,
      }
      return
    }
    const controller = new AbortController()
    setRoutes(null)
    setTradeoff("")
    setExplanations([])
    setSuggestMetro(false)
    setRouteError(null)
    setRoutesLoading(true)
    planHealthRoutes(
      { label: start.name, lat: start.lat, lon: start.lon },
      { label: dest.name, lat: dest.lat, lon: dest.lon },
      {
        asthma: sensitivity(health.asthma),
        copd: sensitivity(health.copd),
        heat: sensitivity(health.heat),
        mode,
        extraMinutesOk: health.extraMinutesOk ?? 10,
      },
      airKnown ? airLevel : undefined,
      live?.feelsC ?? null,
      live?.heatWarning ?? false,
      controller.signal,
    )
      .then((response) => {
        const planned = pairFromResponse(response)
        setRoutes(planned.routes)
        setTradeoff(planned.tradeoff)
        setExplanations(planned.explanations)
        setSuggestMetro(planned.suggestMetro)
        routeMeta.current = {
          tunedFor: planned.tunedFor,
          advisory: planned.advisory,
          healthCost: planned.healthCost,
          busyMinutes: {
            fast: planned.routes.fast.busyMinutes ?? 0,
            clean: planned.routes.clean.busyMinutes ?? 0,
          },
          shadePct: {
            fast: planned.routes.fast.shadePct ?? null,
            clean: planned.routes.clean.shadePct ?? null,
          },
        }
        setRoutesLoading(false)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }
        setRoutes(null)
        setTradeoff("")
        setExplanations([])
        setSuggestMetro(false)
        setRouteError(error instanceof Error ? error.message : "Could not find routes.")
        setRoutesLoading(false)
      })
    return () => controller.abort()
  }, [start, dest, mode, health, airKnown, airLevel, live?.feelsC, live?.heatWarning])

  // New pair of routes: fit the camera around both.
  useEffect(() => {
    if (!routes) {
      return
    }
    const coordinates = [
      ...(routes.fast.coordinates ?? []),
      ...(routes.clean.coordinates ?? []),
    ]
    const frame = requestAnimationFrame(() => {
      if (coordinates.length > 1) {
        mapRef.current?.fitCoordinates(coordinates, fitInsets())
        return
      }
      mapRef.current?.fitPoints(
        [...routes.fast.points, ...routes.clean.points],
        fitInsets(),
        isPhone ? 0.7 : undefined,
      )
    })
    return () => cancelAnimationFrame(frame)
    // Only when the geometry changes, not on every minute or selection change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey])

  // Escape closes the top-most dismissable layer.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return
      }
      if (modal === "health" && welcomeDone) {
        setModal(null)
      } else if (modal === "impact") {
        setModal(null)
      } else if (!modal && accountOpen) {
        setAccountOpen(false)
      } else if (!modal && chatOpen) {
        setChatOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [modal, welcomeDone, accountOpen, chatOpen])

  const planTo = useCallback(
    (place: Place) => {
      setDest(place)
      setDestText(place.name)
      setTwoFields(true)
      setSwapped(false)
      setSelected("clean")
      setTripActive(false)
      if (!start && gpsPlace.current) {
        setStart(gpsPlace.current)
        setStartText(gpsPlace.current.name)
      }
    },
    [start],
  )

  const pickStart = (place: Place) => {
    startChosen.current = true
    setStart(place)
    setStartText(place.name)
    setSwapped(false)
    setSelected("clean")
    setTripActive(false)
  }

  const swap = () => {
    setStart(dest)
    setDest(start)
    setStartText(destText)
    setDestText(startText)
    setSwapped(true)
    setSelected("clean")
    setTripActive(false)
  }

  const clear = () => {
    setDest(null)
    setDestText("")
    startChosen.current = false
    setStart(gpsPlace.current)
    setStartText(gpsPlace.current?.name ?? "")
    setTwoFields(false)
    setSwapped(false)
    setTripActive(false)
    setSelected("clean")
    mapRef.current?.reset()
  }

  const onTrip = () => {
    if (!routes) {
      return
    }
    if (!tripActive) {
      setTripActive(true)
      return
    }
    const route = routes[selected]
    // Same figure as the route card: driving this distance, from the backend (251 g/km).
    const kg = route.drivingCo2g != null ? route.drivingCo2g / 1000 : kgSaved(route.km)
    setTrip({ mode, km: route.km, route: selected, kg })
    setSessionKg((total) => total + kg)
    addTrip(route.km, kg)
    setTripActive(false)
    setModal("impact")
  }

  const screenTrip = (): AssistantTrip | null => {
    const origin = start ?? gpsPlace.current
    if (!routes || !dest || !origin) {
      return null
    }
    const pack = (route: RoutePair["fast"]) => ({
      id: route.id,
      label: route.name,
      durationSeconds: route.minutes * 60,
      distanceMeters: Math.round(route.km * 1000),
      busyShare: route.busy,
      busyMinutes: route.busyMinutes ?? null,
      mainStreets: null,
      shadeShare: route.shadePct == null ? null : route.shadePct / 100,
    })
    return {
      origin: { label: origin.name, lat: origin.lat, lon: origin.lon },
      destination: { label: dest.name, lat: dest.lat, lon: dest.lon },
      mode,
      strictMode: airLevel === "poor",
      tradeoff,
      routes: [pack(routes.fast), pack(routes.clean)],
      tunedFor: routeMeta.current.tunedFor,
      advisory: routeMeta.current.advisory,
      healthCost: routeMeta.current.healthCost,
      busyMinutes: routeMeta.current.busyMinutes,
      shadePct: routeMeta.current.shadePct,
    }
  }

  const applyGroqDirections = (reply: Extract<GroqReply, { kind: "directions" }>) => {
    if (reply.parsed.mode) {
      setMode(reply.parsed.mode)
    }
    const here = /your location|my location|^here$/i.test(reply.origin.label)
    if (!here) {
      const originPlace = placeAt(
        reply.origin.label,
        reply.origin.lon,
        reply.origin.lat,
        "",
        "chat-origin",
      )
      startChosen.current = true
      setStart(originPlace)
      setStartText(originPlace.name)
    } else if (!start && gpsPlace.current) {
      setStart(gpsPlace.current)
      setStartText(gpsPlace.current.name)
    }
    const destPlace = placeAt(
      reply.destination.label,
      reply.destination.lon,
      reply.destination.lat,
      "",
      "chat-dest",
    )
    setDest(destPlace)
    setDestText(destPlace.name)
    setTwoFields(true)
    setSelected("clean")
    setTripActive(false)
  }

  const send = (text: string, hint?: AssistantHint | null) => {
    if (chatBusyRef.current) {
      return
    }
    chatBusyRef.current = true
    const userId = nextId.current++
    const pendingId = nextId.current++
    const history = messages
      .filter((message) => !message.pending)
      .slice(-6)
      .map((message) => ({ role: message.role, text: message.text }))
    const prior = [...messages].reverse().find((message) => message.parsed)?.parsed ?? null
    const origin = start ?? gpsPlace.current
    setMessages((list) => [
      ...list,
      { id: userId, role: "user", text },
      { id: pendingId, role: "assistant", text: "Thinking…", pending: true },
    ])
    setChatBusy(true)
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 15000)
    fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        message: text,
        profile: {
          asthma: sensitivityOrNull(health.asthma),
          copd: sensitivityOrNull(health.copd),
          heat: sensitivityOrNull(health.heat),
          mode,
          extraMinutesOk: health.extraMinutesOk ?? 10,
        },
        userLocation: origin
          ? { label: origin.name, lat: origin.lat, lon: origin.lon }
          : null,
        hint: hint ?? null,
        prior,
        history,
        trip: screenTrip(),
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("assistant")
        }
        return response.json() as Promise<GroqReply>
      })
      .then((reply) => {
        setMessages((list) => list.map((message) => (
          message.id === pendingId
            ? {
                id: pendingId,
                role: "assistant" as const,
                text: replyText(reply),
                sources: reply.sources,
                note: reply.note,
                parsed: reply.parsed,
                hideAdvice: greetingReply(text) !== null,
              }
            : message
        )))
        if (reply.kind === "directions") {
          applyGroqDirections(reply)
        } else if (reply.parsed.mode) {
          setMode(reply.parsed.mode)
        }
      })
      .catch(() => {
        const local = answerMessage(text, {
          start: origin ?? CURRENT_LOCATION,
          mode,
          health,
          scenario,
          airKnown,
          explanations: explanations.length ? explanations : tradeoff ? [tradeoff] : [],
        })
        setMessages((list) => list.map((message) => (
          message.id === pendingId
            ? { id: pendingId, role: "assistant", text: local.text, chips: local.chips, hideAdvice: greetingReply(text) !== null }
            : message
        )))
        if (local.health) {
          setHealth((current) => ({ ...current, ...local.health }))
        }
        if (local.mode) {
          setMode(local.mode)
        }
        if (local.destinationId) {
          planTo(placeById(local.destinationId))
        }
      })
      .finally(() => {
        window.clearTimeout(timer)
        chatBusyRef.current = false
        setChatBusy(false)
      })
  }

  const suggestNearby = () => {
    const here = start ?? gpsPlace.current
    const picks = nearestPlaces(here?.lat ?? MONTREAL.lat, here?.lon ?? MONTREAL.lon)
    setMessages((list) => {
      const last = list[list.length - 1]
      if (last?.text === "Three places near you:") {
        return list
      }
      return [
        ...list,
        {
          id: nextId.current++,
          role: "assistant" as const,
          text: "Three places near you:",
          hideAdvice: true,
          chips: picks.map((name) => ({
            label: name,
            message: `I want to go to ${name}`,
          })),
        },
      ]
    })
  }

  const hasRoutes = routes !== null

  return (
    <div className="app">
      <MapView
        ref={mapRef}
        routes={routes}
        routeKey={routeKey}
        selected={selected}
        onSelectRoute={setSelected}
        start={start}
        destination={dest}
        currentLocation={CURRENT_LOCATION}
        label={
          routes && dest
            ? `Map of Montréal showing a fastest route (${formatMinutes(routes.fast.minutes)}) and a cleaner-air route (${formatMinutes(routes.clean.minutes)}) to ${dest.name}.`
            : "Map of Montréal."
        }
        exposureOn={exposureOn}
        heat={heat}
      />

      <TopBar
        search={{
          twoFields,
          startText,
          destText,
          startPlace: start,
          destPlace: dest,
          onStartText: (value) => {
            startChosen.current = true
            setStartText(value)
            if (!value) {
              setStart(null)
            }
          },
          onDestText: (value) => {
            setDestText(value)
            if (!value) {
              setDest(null)
            }
          },
          onPickStart: pickStart,
          onPickDest: planTo,
          onDirections: () => setTwoFields(true),
          onSwap: swap,
        }}
        onHealth={() => setModal("health")}
        accountOpen={accountOpen}
        onAccountToggle={() => setAccountOpen((open) => !open)}
        onAccountClose={() => setAccountOpen(false)}
        onSignedOut={() => {
          // Signing out forgets what this page knows about the person.
          setHealth(EMPTY_HEALTH)
          setSessionKg(0)
        }}
      />

      {panelVisible && (
        <DirectionsPanel
          ref={panelRef}
          top={panelTop}
          mode={mode}
          onMode={setMode}
          airLevel={airLevel}
          airIndex={airKnown ? scenario.index : null}
          routes={routes}
          selected={selected}
          onSelect={setSelected}
          tradeoff={tradeoff}
          explanations={explanations}
          suggestMetro={suggestMetro}
          loading={routesLoading || (Boolean(dest) && !start && locating)}
          loadingLabel={
            !start && locating
              ? "Finding your location…"
              : "Finding the fastest and cleaner routes…"
          }
          error={routeError ?? (!start && !locating ? locationMessage : null)}
          tripActive={tripActive}
          onTrip={onTrip}
          onClear={clear}
        />
      )}

      <div className={`widgets${hasRoutes ? " has-routes" : ""}`}>
        {exposureOn && (
          <ExposureCard
            open={exposureOpen}
            onToggle={() => setExposureOpen((open) => !open)}
            heatRange={
              heat && heat.minC !== null && heat.maxC !== null
                ? { minC: heat.minC, maxC: heat.maxC }
                : null
            }
          />
        )}
        <AirQualityCard
          live={live}
          health={health}
          open={airOpen}
          onToggle={() => setAirOpen((open) => !open)}
        />
        <WeatherCard live={live} open={weatherOpen} onToggle={() => setWeatherOpen((open) => !open)} />
      </div>

      <MapControls
        onZoomIn={() => mapRef.current?.zoomBy(1.5)}
        onZoomOut={() => mapRef.current?.zoomBy(1 / 1.5)}
        onLocate={() => mapRef.current?.locate()}
        exposureOn={exposureOn}
        onExposure={() => {
          if (!exposureOn) {
            // Make room in the right-hand column: legend open, the others folded.
            setExposureOpen(true)
            setAirOpen(false)
            setWeatherOpen(false)
          }
          setExposureOn(!exposureOn)
        }}
      />

      <ChatAssistant
        open={chatOpen}
        onOpen={() => setChatOpen(true)}
        onClose={() => setChatOpen(false)}
        messages={messages}
        busy={chatBusy}
        onSend={send}
        onPick={(next) => {
          if (next === "places") {
            suggestNearby()
          }
        }}
      />

      {modal === "welcome" && (
        <Modal labelledBy="clair-welcome-title" variant="welcome">
          <WelcomeSheet
            onAddHealth={() => {
              setWelcomeDone(true)
              setModal("health")
            }}
            onSkip={() => {
              setWelcomeDone(true)
              setModal(null)
            }}
          />
        </Modal>
      )}
      {modal === "health" && (
        <Modal labelledBy="clair-health-title">
          <HealthForm
            health={health}
            onChange={setHealth}
            onDone={() => {
              setWelcomeDone(true)
              setModal(null)
            }}
          />
        </Modal>
      )}
      {modal === "impact" && trip && (
        <Modal labelledBy="clair-impact-title">
          <ImpactCard {...trip} sessionKg={sessionKg} onDone={() => setModal(null)} />
        </Modal>
      )}
    </div>
  )
}
