"use client"

import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import type { Place } from "@/data/mock"
import { placeAt, placeFromGeocode, type GeocodeHit } from "@/lib/geocode-place"
import { ArrowRightIcon, CircleIcon, SearchIcon, SwapIcon } from "./icons"

type Field = "start" | "dest"

type SearchBoxProps = {
  twoFields: boolean
  startText: string
  destText: string
  startPlace: Place | null
  destPlace: Place | null
  onStartText: (value: string) => void
  onDestText: (value: string) => void
  onPickStart: (place: Place) => void
  onPickDest: (place: Place) => void
  onDirections: () => void
  onSwap: () => void
}

type Option =
  | { kind: "here" }
  | { kind: "place"; hit: GeocodeHit }

export function SearchBox(props: SearchBoxProps) {
  const { twoFields, startText, destText, startPlace, destPlace } = props
  const [focused, setFocused] = useState<Field | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [active, setActive] = useState(0)
  const [locating, setLocating] = useState(false)
  const destRef = useRef<HTMLInputElement>(null)
  const startRef = useRef<HTMLInputElement>(null)

  const text = focused === "start" ? startText : destText
  const picked = focused === "start" ? startPlace : destPlace
  const query = picked && picked.name === text ? "" : text
  const searching = focused !== null && query.trim().length >= 3
  const { results, loading, settled } = useGeocodeSuggestions(query, searching)

  const options: Option[] = [
    ...(focused === "start" ? [{ kind: "here" as const }] : []),
    ...results.map((hit) => ({ kind: "place" as const, hit })),
  ]
  const showEmpty = searching && settled && !loading && results.length === 0
  const showList = focused !== null && !dismissed && (focused === "start" || searching)

  const pickPlace = (field: Field, place: Place) => {
    if (field === "start") {
      props.onPickStart(place)
      startRef.current?.blur()
    } else {
      props.onPickDest(place)
      destRef.current?.blur()
    }
    setFocused(null)
  }

  const pickHere = (field: Field) => {
    if (!navigator.geolocation) {
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        pickPlace(
          field,
          placeAt("Your location", position.coords.longitude, position.coords.latitude, "Current position", "your-location"),
        )
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    )
  }

  const choose = (field: Field, option: Option) => {
    if (option.kind === "here") {
      pickHere(field)
      return
    }
    pickPlace(field, placeFromGeocode(option.hit))
  }

  const onKeyDown = (field: Field) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setDismissed(false)
      setActive((index) => Math.min(options.length - 1, index + 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setDismissed(false)
      setActive((index) => Math.max(0, index - 1))
    } else if (event.key === "Enter") {
      const option = options[active]
      if (showList && option) {
        event.preventDefault()
        choose(field, option)
      }
    } else if (event.key === "Escape") {
      event.stopPropagation()
      setDismissed(true)
    }
  }

  const fieldProps = (field: Field) => ({
    onFocus: () => {
      setFocused(field)
      setDismissed(false)
      setActive(0)
    },
    onBlur: () => setFocused((current) => (current === field ? null : current)),
    onKeyDown: onKeyDown(field),
    role: "combobox" as const,
    "aria-expanded": focused === field && showList,
    "aria-controls": "clair-suggestions",
    "aria-autocomplete": "list" as const,
    autoComplete: "off",
    spellCheck: false,
  })

  const listTop = focused === "start" || !twoFields ? 52 : 108

  return (
    <div className={`search${twoFields ? " is-two" : ""}`}>
      {twoFields && (
        <label key="start" className="search-field">
          <span className="search-icon start-icon">
            <CircleIcon size={14} strokeWidth={2.4} />
          </span>
          <input
            ref={startRef}
            className="search-input"
            value={startText}
            placeholder="Choose a starting point"
            aria-label="Starting point"
            onChange={(event) => {
              props.onStartText(event.target.value)
              setActive(0)
              setDismissed(false)
            }}
            {...fieldProps("start")}
          />
        </label>
      )}
      <label key="dest" className="search-field">
        <span className="search-icon">
          <SearchIcon size={20} />
        </span>
        <input
          ref={destRef}
          className="search-input"
          value={destText}
          placeholder="Where are you going?"
          aria-label="Destination"
          onChange={(event) => {
            props.onDestText(event.target.value)
            setActive(0)
            setDismissed(false)
          }}
          {...fieldProps("dest")}
        />
        {!twoFields && (
          <button
            type="button"
            className="search-go"
            aria-label="Get directions"
            onClick={() => {
              props.onDirections()
              requestAnimationFrame(() => destRef.current?.focus())
            }}
          >
            <ArrowRightIcon size={18} />
          </button>
        )}
      </label>
      {twoFields && (
        <button type="button" className="search-swap" aria-label="Swap start and destination" onClick={props.onSwap}>
          <SwapIcon size={18} />
        </button>
      )}

      {showList && (
        <ul id="clair-suggestions" className="suggestions" role="listbox" aria-busy={loading} style={{ top: listTop }}>
          {options.map((option, index) =>
            option.kind === "here" ? (
              <li key="here" role="option" aria-selected={index === active}>
                <button
                  type="button"
                  tabIndex={-1}
                  className={`suggestion${index === active ? " is-active" : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => focused && choose(focused, option)}
                >
                  <span className="suggestion-name">Your location</span>
                  <span className="suggestion-area">{locating ? "Finding your location…" : "Use this device's position"}</span>
                </button>
              </li>
            ) : (
              <li key={`${option.hit.lng},${option.hit.lat},${option.hit.name}`} role="option" aria-selected={index === active}>
                <button
                  type="button"
                  tabIndex={-1}
                  className={`suggestion${index === active ? " is-active" : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => focused && choose(focused, option)}
                >
                  <span className="suggestion-name">{option.hit.name}</span>
                  {option.hit.subtitle ? <span className="suggestion-area">{option.hit.subtitle}</span> : null}
                </button>
              </li>
            ),
          )}
          {loading ? <li className="suggestion-empty">Searching…</li> : null}
          {showEmpty ? <li className="suggestion-empty">No places found</li> : null}
        </ul>
      )}
    </div>
  )
}

function useGeocodeSuggestions(query: string, enabled: boolean) {
  const [results, setResults] = useState<GeocodeHit[]>([])
  const [loading, setLoading] = useState(false)
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (!enabled || q.length < 3) {
      setResults([])
      setLoading(false)
      setSettled(false)
      return
    }

    const controller = new AbortController()
    setResults([])
    setLoading(false)
    setSettled(false)
    const timer = window.setTimeout(() => {
      setLoading(true)
      const lang = navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en"
      const params = new URLSearchParams({ q, lang })
      fetch(`/api/geocode?${params.toString()}`, { signal: controller.signal })
        .then(async (response) => (response.ok ? response.json() : []))
        .then((data: unknown) => {
          setResults(isHitList(data) ? data.slice(0, 5) : [])
          setSettled(true)
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return
          }
          setResults([])
          setSettled(true)
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false)
          }
        })
    }, 300)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, enabled])

  return { results, loading, settled }
}

function isHitList(data: unknown): data is GeocodeHit[] {
  return Array.isArray(data) && data.every((item) => item && typeof item.name === "string" && typeof item.lat === "number" && typeof item.lng === "number")
}
