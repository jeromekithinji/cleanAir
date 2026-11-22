import { levelForIndex, trendText, weatherAdvice, windNote, type Scenario } from "@/data/mock"
import {
  AtomIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  SunIcon,
  ThermometerIcon,
  TrendDownIcon,
  TrendUpIcon,
  WindIcon,
} from "./icons"

type WeatherCardProps = {
  scenario: Scenario
  open: boolean
  onToggle: () => void
}

const BARS = [4, 7, 10, 13, 16, 20]

export function WeatherCard({ scenario, open, onToggle }: WeatherCardProps) {
  const level = levelForIndex(scenario.index)
  const hotter = scenario.feels - scenario.temp >= 3
  const trend = scenario.index > scenario.previous ? "up" : scenario.index < scenario.previous ? "down" : "steady"
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
      <p className="widget-sub">Environment Canada · Montréal</p>
      <p className="weather-advice">{weatherAdvice(level)}</p>
      {open && (
        <>
          <div className="tiles">
            <div className="tile">
              <div className="tile-label">
                <SunIcon size={16} />
                {scenario.sky}
              </div>
              <div className="tile-value">{scenario.temp}°C</div>
              <div className={`tile-note${hotter ? " is-hot" : ""}`}>Feels like {scenario.feels}°</div>
            </div>
            <div className="tile">
              <div className="tile-label">
                <WindIcon size={16} />
                Wind
              </div>
              <div className="tile-value">{scenario.wind} km/h</div>
              <div className="tile-note">{windNote(scenario.wind)}</div>
            </div>
          </div>
          <div className="weather-rows">
            <div className="weather-row">
              <AtomIcon size={18} />
              <span className="weather-row-label">Main pollutant</span>
              <span className="weather-row-value is-strong">{scenario.pollutant}</span>
            </div>
            <div className="weather-row">
              {trend === "down" ? <TrendDownIcon size={18} /> : <TrendUpIcon size={18} />}
              <span className="weather-row-label">Trend</span>
              <span className="weather-row-value">
                <span className={`bars bars-${trend}`} aria-hidden="true">
                  {BARS.map((h, i) => (
                    <span key={i} style={{ height: h }} />
                  ))}
                </span>
                {trendText(scenario.index, scenario.previous)}
              </span>
            </div>
            <div className="weather-row">
              <ClockIcon size={18} />
              <span className="weather-row-label">Best time to go</span>
              <span className="weather-row-value is-best">{scenario.best}</span>
            </div>
          </div>
          {scenario.heatWarning && (
            <p className="heat-banner">
              <ThermometerIcon size={20} />
              Heat warning in effect today
            </p>
          )}
        </>
      )}
    </section>
  )
}
