"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { RouteMap } from "@/components/route-map"
import { sampleTrip, searchPlaces, type SamplePlace } from "@/lib/sample-trip"
import type { Place, RoutesResponse } from "@/lib/types"

const YOUR_LOCATION = "Your location"

type Field = "origin" | "destination"

export function MapScreen() {
  const panelRef = useRef<HTMLDivElement>(null)
  const originTouched = useRef(false)
  const [userLocation, setUserLocation] = useState<Place | null>(null)
  const [origin, setOrigin] = useState<Place | null>(null)
  const [destination, setDestination] = useState<Place | null>(null)
  const [originQuery, setOriginQuery] = useState("")
  const [destinationQuery, setDestinationQuery] = useState("")
  const [activeField, setActiveField] = useState<Field | null>(null)
  const [selectedId, setSelectedId] = useState<"fast" | "clean">("clean")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)
  const [directionsOpen, setDirectionsOpen] = useState(false)

  useEffect(() => {
    if (!navigator.geolocation) {
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const place: Place = {
          label: YOUR_LOCATION,
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        }
        setUserLocation(place)
        if (!originTouched.current) {
          setOrigin(place)
          setOriginQuery(YOUR_LOCATION)
        }
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  }, [])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setActiveField(null)
        setSearchFocused(false)
      }
    }
    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [])

  const activeQuery = activeField === "origin" ? originQuery : destinationQuery
  const otherLabel =
    activeField === "origin" ? destination?.label : origin?.label
  const placeMatches = useMemo(() => {
    if (!activeField) {
      return []
    }
    return searchPlaces(activeQuery).filter(
      (place) => place.label !== otherLabel,
    )
  }, [activeField, activeQuery, otherLabel])
  const showYourLocation = Boolean(
    userLocation &&
      otherLabel !== YOUR_LOCATION &&
      matchesYourLocation(activeQuery),
  )
  const selectionMatchesQuery =
    activeField === "origin"
      ? origin?.label === originQuery
      : destination?.label === destinationQuery
  const listOpen =
    activeField !== null &&
    !selectionMatchesQuery &&
    (showYourLocation || placeMatches.length > 0)

  const searchMatches = useMemo(
    () => (directionsOpen ? [] : searchPlaces(searchQuery)),
    [directionsOpen, searchQuery],
  )
  const searchOpen =
    !directionsOpen && searchFocused && searchMatches.length > 0

  const trip: RoutesResponse | null =
    origin && destination ? sampleTrip(origin, destination) : null

  function handleSearchPick(place: SamplePlace) {
    if (!origin && userLocation) {
      setOrigin(userLocation)
      setOriginQuery(YOUR_LOCATION)
    }
    setDestination(place)
    setDestinationQuery(place.label)
    setSearchQuery("")
    setDirectionsOpen(true)
    setSelectedId("clean")
    setActiveField(null)
  }

  function handleOpenDirections() {
    const typed = searchQuery.trim()
    const first = typed ? searchPlaces(typed)[0] : undefined
    if (first) {
      handleSearchPick(first)
      return
    }
    setDirectionsOpen(true)
    setActiveField("destination")
  }

  function handleBack() {
    setDirectionsOpen(false)
    setDestination(null)
    setDestinationQuery("")
    setSearchQuery("")
    setActiveField(null)
    setSelectedId("clean")
  }

  function handlePickYourLocation() {
    if (!userLocation || !activeField) {
      return
    }
    if (activeField === "origin") {
      originTouched.current = true
      setOrigin(userLocation)
      setOriginQuery(YOUR_LOCATION)
    } else {
      setDestination(userLocation)
      setDestinationQuery(YOUR_LOCATION)
    }
    setSelectedId("clean")
    setActiveField(null)
  }

  function handlePickPlace(place: SamplePlace) {
    if (activeField === "destination") {
      setDestination(place)
      setDestinationQuery(place.label)
    } else {
      originTouched.current = true
      setOrigin(place)
      setOriginQuery(place.label)
    }
    setSelectedId("clean")
    setActiveField(null)
  }

  function handleSwap() {
    originTouched.current = true
    setOrigin(destination)
    setDestination(origin)
    setOriginQuery(destination?.label ?? "")
    setDestinationQuery(origin?.label ?? "")
    setSelectedId("clean")
    setActiveField(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!directionsOpen) {
      const first = searchMatches[0]
      if (first) {
        handleSearchPick(first)
      }
      return
    }
    if (showYourLocation && placeMatches.length === 0) {
      handlePickYourLocation()
      return
    }
    const first = placeMatches[0]
    if (first) {
      handlePickPlace(first)
    }
  }

  return (
    <div className="fixed inset-0 bg-zinc-100">
      <RouteMap
        origin={origin}
        destination={destination}
        userLocation={userLocation}
        routes={trip?.routes ?? []}
        selectedId={trip ? selectedId : null}
        onSelect={setSelectedId}
      />
      <div className="pointer-events-none absolute left-0 top-0 z-10 w-full max-w-md px-3 pt-3 sm:px-4">
        <div ref={panelRef} className="pointer-events-auto w-full">
          {directionsOpen ? (
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBack}
              aria-label="Back to search"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-zinc-800 shadow-sm"
            >
              <BackIcon />
            </button>
            <div className="flex w-7 shrink-0 flex-col items-center self-stretch py-3.5">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-zinc-900 bg-white" />
              <span className="flex flex-1 flex-col items-center justify-center gap-1">
                <span className="h-[3px] w-[3px] rounded-full bg-zinc-500" />
                <span className="h-[3px] w-[3px] rounded-full bg-zinc-500" />
                <span className="h-[3px] w-[3px] rounded-full bg-zinc-500" />
              </span>
              <PinIcon />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <label className="sr-only" htmlFor="origin-search">
                Starting point
              </label>
              <input
                id="origin-search"
                value={originQuery}
                placeholder={YOUR_LOCATION}
                autoComplete="off"
                onChange={(event) => {
                  originTouched.current = true
                  setOriginQuery(event.target.value)
                  setActiveField("origin")
                  if (origin && event.target.value !== origin.label) {
                    setOrigin(null)
                  }
                }}
                onFocus={() => setActiveField("origin")}
                className="h-12 rounded-xl border border-zinc-300 bg-white px-4 text-[15px] text-zinc-900 shadow-sm outline-none placeholder:text-zinc-500 focus:border-zinc-400"
              />
              <label className="sr-only" htmlFor="destination-search">
                Destination
              </label>
              <input
                id="destination-search"
                value={destinationQuery}
                placeholder="Where to?"
                autoComplete="off"
                onChange={(event) => {
                  setDestinationQuery(event.target.value)
                  setActiveField("destination")
                  if (
                    destination &&
                    event.target.value !== destination.label
                  ) {
                    setDestination(null)
                  }
                }}
                onFocus={() => setActiveField("destination")}
                className="h-12 rounded-xl border border-zinc-300 bg-white px-4 text-[15px] text-zinc-900 shadow-sm outline-none placeholder:text-zinc-500 focus:border-zinc-400"
              />
            </div>
            <button
              type="button"
              onClick={handleSwap}
              aria-label="Swap start and end"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-zinc-800 shadow-sm"
            >
              <SwapIcon />
            </button>
          </form>
          ) : (
          <form
            onSubmit={handleSubmit}
            className="flex h-12 items-center rounded-full bg-white pl-5 pr-1.5 shadow-[0_1px_6px_rgba(0,0,0,0.28)]"
          >
            <label className="sr-only" htmlFor="place-search">
              Search a place in Montréal
            </label>
            <input
              id="place-search"
              value={searchQuery}
              placeholder="Search Montréal"
              autoComplete="off"
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setSearchFocused(true)
              }}
              onFocus={() => setSearchFocused(true)}
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-500"
            />
            <SearchIcon />
            <button
              type="button"
              onClick={handleOpenDirections}
              aria-label="Directions"
              className="ml-2 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#0f766e] text-white"
            >
              <DirectionsIcon />
            </button>
          </form>
          )}
          {searchOpen ? (
            <ul className="mt-2 overflow-hidden rounded-2xl bg-white py-1 shadow-[0_2px_10px_rgba(0,0,0,0.18)]">
              {searchMatches.map((place) => (
                <li key={place.label}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSearchPick(place)}
                    className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-zinc-50"
                  >
                    <span className="text-sm font-medium text-zinc-900">
                      {place.label}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {place.neighbourhood}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {listOpen ? (
            <ul className="mt-2 overflow-hidden rounded-2xl bg-white py-1 shadow-[0_2px_10px_rgba(0,0,0,0.18)]">
              {showYourLocation ? (
                <li>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={handlePickYourLocation}
                    className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-zinc-50"
                  >
                    <span className="text-sm font-medium text-zinc-900">
                      {YOUR_LOCATION}
                    </span>
                    <span className="text-xs text-zinc-500">
                      Current location
                    </span>
                  </button>
                </li>
              ) : null}
              {placeMatches.map((place) => (
                <li key={place.label}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handlePickPlace(place)}
                    className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-zinc-50"
                  >
                    <span className="text-sm font-medium text-zinc-900">
                      {place.label}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {place.neighbourhood}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {trip && origin && destination ? (
            <div className="mt-2 overflow-hidden rounded-2xl bg-white shadow-[0_2px_10px_rgba(0,0,0,0.18)]">
              <p className="px-4 pt-3 text-xs font-medium text-zinc-500">
                From {origin.label} · {trip.tradeoff}
              </p>
              <div className="grid grid-cols-2 gap-2 p-2">
                {trip.routes.map((route) => {
                  const selected = route.id === selectedId
                  const minutes = Math.round(route.duration_seconds / 60)
                  return (
                    <button
                      key={route.id}
                      type="button"
                      onClick={() => setSelectedId(route.id)}
                      className={`rounded-xl px-3 py-2 text-left ${
                        selected ? "bg-zinc-100" : "hover:bg-zinc-50"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            background:
                              route.id === "clean" ? "#0b8043" : "#1a73e8",
                          }}
                        />
                        {route.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        {minutes} min
                      </span>
                    </button>
                  )
                })}
              </div>
              {trip.routes
                .find((route) => route.id === "clean")
                ?.explanations.map((line) => (
                  <p
                    key={line}
                    className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-600"
                  >
                    {line}
                  </p>
                ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function matchesYourLocation(query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return true
  }
  return "your location"
    .split(" ")
    .some((word) => word.startsWith(needle) || needle.startsWith(word))
}

function SearchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="shrink-0 text-zinc-500"
    >
      <path
        fill="currentColor"
        d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79L20 21.5 21.5 20zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14"
      />
    </svg>
  )
}

function DirectionsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M4 11h12.2l-3.6-3.6L14 6l6 6-6 6-1.4-1.4 3.6-3.6H4z" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20 11H7.8l4.6-4.6L11 5l-7 7 7 7 1.4-1.4L7.8 13H20z"
      />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="shrink-0 text-[#d93025]"
    >
      <path
        fill="currentColor"
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"
      />
    </svg>
  )
}

function SwapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 3 5 7h3v7h2V7h3L9 3zm6 17 4-4h-3v-7h-2v7h-3l4 4z"
      />
    </svg>
  )
}
