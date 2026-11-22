import { levelForIndex, weatherAdvice, windNote } from "@/data/mock"
import type { LiveConditions } from "@/lib/live-view"
import {
  AtomIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  CloudIcon,
  SunIcon,
  ThermometerIcon,
  WindIcon,
} from "./icons"

type WeatherCardProps = {
  live: LiveConditions | null
  open: boolean
  onToggle: () => void
}

export function WeatherCard({ live, open, onToggle }: WeatherCardProps) {
  const level = live?.index == null ? "unknown" : levelForIndex(live.index)
  const temp = live?.tempC == null ? null : Math.round(live.tempC)
  const feels = live?.feelsC == null ? null : Math.round(live.feelsC)
  const wind = live?.windKmh == null ? null : Math.round(live.windKmh)
  const hotter = temp != null && feels != null && feels - temp >= 3
  const place = live?.weatherSource === "unavailable" ? "Weather unavailable" : "Montréal"
  const source = live?.weatherSource === "live" ? "Open-Meteo · live" : "Open-Meteo"
  return (
    <section className={`widget weather-card${open ? " is-open" : ""}`} aria-label="Weather and timing">
      <div className="widget-head">
        <SunIcon size={20} />
        <h2 className="widget-title">Weather and timing</h2>
        <button
          type="button"
          className="chevron-btn"
          aria-expanded={open}
          aria-label={open ? "Collapse weather and timing" : "Expand weather and timing"}
          onClick={onToggle}
        >
          {open ? <ChevronDownIcon size={20} /> : <ChevronUpIcon size={20} />}
        </button>
      </div>
      <p className="widget-sub">{live ? place : "Loading the latest forecast…"}</p>
      <p className="weather-advice">
        {level === "unknown" ? "Waiting for a live reading" : weatherAdvice(level)}
      </p>
      {open && live && (
        <>
          <div className="tiles">
            <div className="tile">
              <div className="tile-label">
                <SunIcon size={16} />
                {live.sky}
              </div>
              <div className="tile-value">{temp == null ? "—" : `${temp}°C`}</div>
              <div className={`tile-note${hotter ? " is-hot" : ""}`}>
                {feels == null ? "Feels like —" : `Feels like ${feels}°`}
              </div>
            </div>
            <div className="tile">
              <div className="tile-label">
                <WindIcon size={16} />
                Wind
              </div>
              <div className="tile-value">{wind == null ? "—" : `${wind} km/h`}</div>
              <div className="tile-note">{wind == null ? "No wind reading" : windNote(wind)}</div>
            </div>
          </div>
          <div className="weather-rows">
            <div className="weather-row">
              <AtomIcon size={18} />
              <span className="weather-row-label">Main pollutant</span>
              <span className="weather-row-value is-strong">{live.pollutant}</span>
            </div>
            <div className="weather-row">
              <CloudIcon size={18} />
              <span className="weather-row-label">Rain chance</span>
              <span className="weather-row-value">
                {live.rainChance == null ? "—" : `${Math.round(live.rainChance)}%`}
              </span>
            </div>
            <div className="weather-row">
              <ClockIcon size={18} />
              <span className="weather-row-label">Best time to go</span>
              <span className="weather-row-value is-best">{live.bestTime}</span>
            </div>
          </div>
          {live.heatWarning && (
            <p className="heat-banner">
              <ThermometerIcon size={20} />
              Heat warning in effect today
            </p>
          )}
          <div className="widget-footer">
            <p className="widget-updated">
              {live.weatherUpdatedLabel ? `Last updated ${live.weatherUpdatedLabel}` : ""}
            </p>
            {live.weatherSource !== "unavailable" ? <p className="widget-source">{source}</p> : null}
          </div>
        </>
      )}
    </section>
  )
}
