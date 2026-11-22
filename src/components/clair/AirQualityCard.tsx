import {
  airCardNote,
  formatClock,
  levelForIndex,
  levelLabel,
  pollutantReadings,
  type Health,
  type Scenario,
} from "@/data/mock"
import { ChevronDownIcon, ChevronUpIcon, WindIcon } from "./icons"

type AirQualityCardProps = {
  scenario: Scenario
  health: Health
  now: Date | null
  open: boolean
  onToggle: () => void
  onDemo: () => void
}

export function AirQualityCard({ scenario, health, now, open, onToggle, onDemo }: AirQualityCardProps) {
  const level = levelForIndex(scenario.index)
  const r = pollutantReadings(scenario.index)
  const marker = Math.min(100, Math.max(0, (scenario.index / 100) * 100))
  return (
    <section className={`widget air-card${open ? " is-open" : ""}`} aria-label="Air now">
      <div className="widget-head">
        <WindIcon size={20} />
        <h2 className="widget-title">Air now</h2>
        <button type="button" className="demo-btn" onClick={onDemo} aria-label="Demo: try the next sample scenario">
          Demo
        </button>
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
      <p className="widget-sub">Saint-Jean-Baptiste station · {now ? formatClock(now) : ""}</p>
      <div className="air-index">
        <span className="air-number">{scenario.index}</span>
        <span className={`air-badge air-${level}`}>{levelLabel(level)}</span>
      </div>
      {open && (
        <>
          <div className="gauge" aria-hidden="true">
            <span className="gauge-marker" style={{ left: `${marker}%` }} />
          </div>
          <dl className="readings">
            <div>
              <dt>{r.pm25}</dt>
              <dd>PM2.5 µg/m³</dd>
            </div>
            <div>
              <dt>{r.no2}</dt>
              <dd>NO₂ ppb</dd>
            </div>
            <div>
              <dt>{r.o3}</dt>
              <dd>O₃ ppb</dd>
            </div>
            <div>
              <dt>{r.so2}</dt>
              <dd>SO₂ ppb</dd>
            </div>
          </dl>
          <p className={`air-note air-${level}`}>{airCardNote(health, level)}</p>
        </>
      )}
    </section>
  )
}
