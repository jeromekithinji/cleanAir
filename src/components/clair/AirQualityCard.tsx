import { airCardNote, levelForIndex, levelLabel, type Health } from "@/data/mock"
import type { LiveConditions } from "@/lib/live-view"
import { ChevronDownIcon, ChevronUpIcon, WindIcon } from "./icons"

type AirQualityCardProps = {
  live: LiveConditions | null
  health: Health
  open: boolean
  onToggle: () => void
}

export function AirQualityCard({ live, health, open, onToggle }: AirQualityCardProps) {
  const level = live?.index == null ? "unknown" : levelForIndex(live.index)
  const marker = live?.index == null ? 0 : Math.min(100, Math.max(0, live.index))
  const station = live?.stationName ?? "Nearest station"
  return (
    <section className={`widget air-card${open ? " is-open" : ""}`} aria-label="Air now">
      <div className="widget-head">
        <WindIcon size={20} />
        <h2 className="widget-title">Air now</h2>
        <button
          type="button"
          className="chevron-btn"
          aria-expanded={open}
          aria-label={open ? "Collapse air quality" : "Expand air quality"}
          onClick={onToggle}
        >
          {open ? <ChevronDownIcon size={20} /> : <ChevronUpIcon size={20} />}
        </button>
      </div>
      <p className="widget-sub">{live ? station : "Loading the latest RSQA reading…"}</p>
      <div className="air-index">
        <span className="air-number">{live?.index ?? "—"}</span>
        <span className={`air-badge air-${level}`}>{level === "unknown" ? "Unknown" : levelLabel(level)}</span>
      </div>
      {open && live && (
        <>
          <div className="gauge" aria-hidden="true">
            <span className="gauge-marker" style={{ left: `${marker}%` }} />
          </div>
          <dl className="readings">
            <div>
              <dt>{live.pollutant}</dt>
              <dd>Main pollutant</dd>
            </div>
            <div>
              <dt>{live.neighbourhood || "Montréal"}</dt>
              <dd>Neighbourhood</dd>
            </div>
          </dl>
          <p className={`air-note air-${level}`}>
            {level === "unknown"
              ? "No RSQA station is close enough for a reading."
              : airCardNote(health, level)}
          </p>
          {live.observedLabel ? <p className="widget-updated">Last updated {live.observedLabel}</p> : null}
        </>
      )}
    </section>
  )
}
