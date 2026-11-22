import { ChevronDownIcon, ChevronUpIcon, ExposureIcon } from "./icons"

type ExposureCardProps = {
  open: boolean
  onToggle: () => void
  /** Feels-like range of the heat layer, when loaded. */
  heatRange: { minC: number; maxC: number } | null
}

/** Legend for the exposure map, in the same column and style as the air and weather cards. */
export function ExposureCard({ open, onToggle, heatRange }: ExposureCardProps) {
  return (
    <section className={`widget exposure-card${open ? " is-open" : ""}`} aria-label="Exposure map">
      <div className="widget-head">
        <ExposureIcon size={20} />
        <h2 className="widget-title">Exposure map</h2>
        <button
          type="button"
          className="chevron-btn"
          aria-expanded={open}
          aria-label={open ? "Collapse exposure map legend" : "Expand exposure map legend"}
          onClick={onToggle}
        >
          {open ? <ChevronDownIcon size={20} /> : <ChevronUpIcon size={20} />}
        </button>
      </div>
      <p className="widget-sub">Busy roads and heat across Montréal</p>
      {open && (
        <>
          <p className="exposure-legend-label">Busy roads</p>
          <ul className="exposure-roads">
            <li>
              <span className="exposure-road exposure-road-highway" aria-hidden="true" />
              Highway
            </li>
            <li>
              <span className="exposure-road exposure-road-main" aria-hidden="true" />
              Main road
            </li>
            <li>
              <span className="exposure-road exposure-road-secondary" aria-hidden="true" />
              Secondary
            </li>
          </ul>
          <p className="exposure-legend-label">Feels like</p>
          <span className="exposure-heat-bar" aria-hidden="true" />
          <p className="exposure-heat-range">
            {heatRange
              ? `${Math.round(heatRange.minC)}°C to ${Math.round(heatRange.maxC)}°C across Montréal`
              : "Loading heat…"}
          </p>
        </>
      )}
    </section>
  )
}
