import type { CSSProperties, Ref } from "react"
import { airDirectionLine, type AirLevel, type Mode } from "@/data/mock"
import type { RouteId, RoutePair } from "@/lib/routing"
import { BikeIcon, CloseIcon, WalkIcon } from "./icons"
import { RouteCard } from "./RouteCard"

/** Idle, the demo progress bar, or waiting for End trip. */
export type TripPhase = "idle" | "walking" | "arrived"

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
  tripPhase: TripPhase
  tripProgress: number
  onTrip: () => void
  onClear: () => void
}

function TripButton({
  phase,
  progress,
  onTrip,
}: {
  phase: TripPhase
  progress: number
  onTrip: () => void
}) {
  const walking = phase === "walking"
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100)
  const label = phase === "arrived" ? "End trip" : walking ? `In progress ${percent}%` : "Start trip"
  return (
    <button
      type="button"
      className={`btn-primary trip-btn${walking ? " is-progress" : ""}`}
      style={walking ? ({ "--trip-progress": `${percent}%` } as CSSProperties) : undefined}
      onClick={onTrip}
      role={walking ? "progressbar" : undefined}
      aria-valuemin={walking ? 0 : undefined}
      aria-valuemax={walking ? 100 : undefined}
      aria-valuenow={walking ? percent : undefined}
      aria-valuetext={walking ? `${percent}% of the route` : undefined}
    >
      <span className="trip-btn-label">{label}</span>
    </button>
  )
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
          <TripButton phase={props.tripPhase} progress={props.tripProgress} onTrip={props.onTrip} />
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
