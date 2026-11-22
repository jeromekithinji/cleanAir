import type { CSSProperties, Ref } from "react"
import { airDirectionLine, type AirLevel, type Mode } from "@/data/mock"
import type { RouteId, RoutePair } from "@/lib/routing"
import { BikeIcon, CloseIcon, WalkIcon } from "./icons"
import { RouteCard } from "./RouteCard"

type DirectionsPanelProps = {
  ref?: Ref<HTMLElement>
  top: number
  mode: Mode
  onMode: (mode: Mode) => void
  airLevel: AirLevel | "unknown"
  airIndex: number | null
  routes: RoutePair | null
  selected: RouteId
  onSelect: (id: RouteId) => void
  tradeoff: string
  explanations: string[]
  suggestMetro: boolean
  loading: boolean
  loadingLabel?: string
  error: string | null
  tripActive: boolean
  onTrip: () => void
  onClear: () => void
}

export function DirectionsPanel(props: DirectionsPanelProps) {
  const { ref, top, mode, airLevel, airIndex, routes, selected } = props
  return (
    <section ref={ref} className="directions" style={{ "--panel-top": `${top}px` } as CSSProperties} aria-label="Directions">
      <div className="directions-head">
        <h2 className="directions-title">Directions</h2>
        <button type="button" className="text-btn" onClick={props.onClear}>
          <CloseIcon size={18} />
          Clear
        </button>
      </div>

      <div className="tabs" role="group" aria-label="Travel mode">
        <button type="button" className="tab" aria-pressed={mode === "walk"} onClick={() => props.onMode("walk")}>
          <WalkIcon size={20} />
          Walk
        </button>
        <button type="button" className="tab" aria-pressed={mode === "bike"} onClick={() => props.onMode("bike")}>
          <BikeIcon size={20} />
          Bike
        </button>
      </div>

      <p className={`air-line air-${airLevel}`}>{airDirectionLine(airLevel, airIndex)}</p>

      {routes ? (
        <>
          <div className="route-cards">
            <RouteCard route={routes.fast} selected={selected === "fast"} onSelect={() => props.onSelect("fast")} showBusy={mode === "bike"} />
            <RouteCard route={routes.clean} selected={selected === "clean"} onSelect={() => props.onSelect("clean")} showBusy={mode === "bike"} />
          </div>
          {selected === "clean" && props.tradeoff ? <p className="tradeoff">{props.tradeoff}</p> : null}
          {props.suggestMetro ? (
            <p className="air-line air-poor">Air is poor, so the metro is a better trip today.</p>
          ) : null}
          {props.explanations.length > 0 ? (
            <ul className="why">
              {props.explanations.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          <button type="button" className="btn-primary" onClick={props.onTrip}>
            {props.tripActive ? "Finish trip" : "Start trip"}
          </button>
        </>
      ) : props.loading ? (
        <p className="directions-empty">{props.loadingLabel ?? "Finding the fastest and cleaner routes…"}</p>
      ) : props.error ? (
        <p className="directions-empty">{props.error}</p>
      ) : (
        <p className="directions-empty">Pick a different start and destination.</p>
      )}
    </section>
  )
}
