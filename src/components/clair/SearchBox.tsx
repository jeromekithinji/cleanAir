"use client"

import { useRef, useState, type KeyboardEvent } from "react"
import { filterPlaces, PLACES, type Place } from "@/data/mock"
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

export function SearchBox(props: SearchBoxProps) {
  const { twoFields, startText, destText, startPlace, destPlace } = props
  const [focused, setFocused] = useState<Field | null>(null)
  const [active, setActive] = useState(0)
  const destRef = useRef<HTMLInputElement>(null)
  const startRef = useRef<HTMLInputElement>(null)

  const text = focused === "start" ? startText : destText
  const picked = focused === "start" ? startPlace : destPlace
  const query = picked && picked.name === text ? "" : text
  const suggestions = focused ? (query.trim() ? filterPlaces(query) : PLACES) : []

  const pick = (field: Field, place: Place) => {
    if (field === "start") {
      props.onPickStart(place)
      startRef.current?.blur()
    } else {
      props.onPickDest(place)
      destRef.current?.blur()
    }
    setFocused(null)
  }

  const onKeyDown = (field: Field) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((i) => Math.min(suggestions.length - 1, i + 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (event.key === "Enter") {
      const place = suggestions[active]
      if (place) {
        event.preventDefault()
        pick(field, place)
      }
    } else if (event.key === "Escape") {
      event.stopPropagation()
      setFocused(null)
      event.currentTarget.blur()
    }
  }

  const fieldProps = (field: Field) => ({
    onFocus: () => {
      setFocused(field)
      setActive(0)
    },
    onBlur: () => setFocused((f) => (f === field ? null : f)),
    onKeyDown: onKeyDown(field),
    role: "combobox" as const,
    "aria-expanded": focused === field && suggestions.length > 0,
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

      {focused && (
        <ul id="clair-suggestions" className="suggestions" role="listbox" style={{ top: listTop }}>
          {suggestions.length === 0 ? (
            <li className="suggestion-empty">No match in this demo. Try Atwater Market.</li>
          ) : (
            suggestions.map((place, index) => (
              <li key={place.id} role="option" aria-selected={index === active}>
                <button
                  type="button"
                  tabIndex={-1}
                  className={`suggestion${index === active ? " is-active" : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(focused, place)}
                >
                  <span className="suggestion-name">{place.name}</span>
                  <span className="suggestion-area">{place.neighborhood}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
