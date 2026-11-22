"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import {
  CURRENT_LOCATION,
  EMPTY_HEALTH,
  highestLevel,
  levelForIndex,
  placeById,
  type Health,
  type Mode,
  type Place,
  type Scenario,
} from "@/data/mock"
import { toScenario, type LiveConditions } from "@/lib/live-view"
import { answerMessage } from "@/lib/clair-assistant"
import { kgSaved } from "@/lib/impact"
import { buildRoutes, routeExplanations, toPath, tradeoffLine, type RouteId } from "@/lib/routing"
import { AirQualityCard } from "./AirQualityCard"
import { ChatAssistant, type ChatMessage } from "./ChatAssistant"
import { DirectionsPanel } from "./DirectionsPanel"
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

const GREETING: ChatMessage = {
  id: 0,
  role: "assistant",
  text: "Hi, I can plan a cleaner-air trip for you. Where are you going, and how will you get there?",
}

export function App() {
  const mapRef = useRef<MapViewHandle>(null)
  const panelRef = useRef<HTMLElement>(null)
  const nextId = useRef(1)
  const livePoint = useRef(MONTREAL)

  const [modal, setModal] = useState<ModalState>("welcome")
  const [welcomeDone, setWelcomeDone] = useState(false)
  const [health, setHealth] = useState<Health>(EMPTY_HEALTH)
  const [live, setLive] = useState<LiveConditions | null>(null)
  const [mode, setMode] = useState<Mode>("walk")

  const [start, setStart] = useState<Place | null>(CURRENT_LOCATION)
  const [dest, setDest] = useState<Place | null>(null)
  const [startText, setStartText] = useState(CURRENT_LOCATION.name)
  const [destText, setDestText] = useState("")
  const [twoFields, setTwoFields] = useState(false)
  const [swapped, setSwapped] = useState(false)

  const [selected, setSelected] = useState<RouteId>("clean")
  const [tripActive, setTripActive] = useState(false)
  const [trip, setTrip] = useState<Trip | null>(null)
  const [sessionKg, setSessionKg] = useState(0)

  const [airOpen, setAirOpen] = useState(true)
  const [weatherOpen, setWeatherOpen] = useState(true)
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

  const scenario = live ? toScenario(live) : EMPTY_SCENARIO
  const airKnown = live?.index != null
  const airLevel = airKnown ? levelForIndex(scenario.index) : "unknown"
  const poorAir = airLevel === "poor"

  const routes = useMemo(
    () => (start && dest ? buildRoutes(start, dest, mode, highestLevel(health), poorAir) : null),
    [start, dest, mode, health, poorAir],
  )
  const routeKey = routes ? `${toPath(routes.fast.points)}|${toPath(routes.clean.points)}` : ""
  const explanations = useMemo(
    () => (routes ? routeExplanations(routes.fast, health, poorAir) : []),
    [routes, health, poorAir],
  )
  const tradeoff = routes ? tradeoffLine(routes.fast, routes.clean) : ""
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
    if (!navigator.geolocation) {
      load(MONTREAL.lat, MONTREAL.lon)
      return () => {
        cancelled = true
      }
    }
    navigator.geolocation.getCurrentPosition(
      (position) => load(position.coords.latitude, position.coords.longitude),
      () => load(MONTREAL.lat, MONTREAL.lon),
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 60_000 },
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

  const fitInsets = useCallback((): Insets => {
    if (isPhone) {
      const panel = panelRef.current
      const bottomOfPanel = panel ? panel.getBoundingClientRect().bottom : panelTop
      return { top: bottomOfPanel + 24, right: 24, bottom: 24, left: 24 }
    }
    return { top: 66, right: 156, bottom: 66, left: 12 + 456 + 24 }
  }, [isPhone, panelTop])

  // New pair of routes: fit the camera around both.
  useEffect(() => {
    if (!routes) {
      return
    }
    const frame = requestAnimationFrame(() => {
      mapRef.current?.fitPoints([...routes.fast.points, ...routes.clean.points], fitInsets(), isPhone ? 0.7 : undefined)
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
      if (!start) {
        setStart(CURRENT_LOCATION)
        setStartText(CURRENT_LOCATION.name)
      }
    },
    [start],
  )

  const pickStart = (place: Place) => {
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
    setStart(CURRENT_LOCATION)
    setStartText(CURRENT_LOCATION.name)
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
    const kg = kgSaved(route.km)
    setTrip({ mode, km: route.km, route: selected, kg })
    setSessionKg((total) => total + kg)
    setTripActive(false)
    setModal("impact")
  }

  const send = (text: string) => {
    const reply = answerMessage(text, {
      start: start ?? CURRENT_LOCATION,
      mode,
      health,
      scenario,
      airKnown,
      explanations,
    })
    const userMsg: ChatMessage = { id: nextId.current++, role: "user", text }
    const botMsg: ChatMessage = { id: nextId.current++, role: "assistant", text: reply.text, chips: reply.chips }
    setMessages((list) => [...list, userMsg, botMsg])
    if (reply.health) {
      setHealth((current) => ({ ...current, ...reply.health }))
    }
    if (reply.mode) {
      setMode(reply.mode)
    }
    if (reply.destinationId) {
      planTo(placeById(reply.destinationId))
    }
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
            ? `Map of Montréal showing a fastest route (${routes.fast.minutes} min) and a cleaner-air route (${routes.clean.minutes} min) to ${dest.name}.`
            : "Map of Montréal around Mile End, with Rue Notre-Dame, a busy truck route, crossing it."
        }
      />

      <TopBar
        search={{
          twoFields,
          startText,
          destText,
          startPlace: start,
          destPlace: dest,
          onStartText: (value) => {
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
          tripActive={tripActive}
          onTrip={onTrip}
          onClear={clear}
        />
      )}

      <div className={`widgets${hasRoutes ? " has-routes" : ""}`}>
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
        onLocate={() => mapRef.current?.flyTo(CURRENT_LOCATION, 2)}
      />

      <ChatAssistant
        open={chatOpen}
        onOpen={() => setChatOpen(true)}
        onClose={() => setChatOpen(false)}
        messages={messages}
        onSend={send}
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
