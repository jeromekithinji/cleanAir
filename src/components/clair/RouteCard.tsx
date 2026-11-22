import { format1 } from "@/data/mock"
import { kgSaved } from "@/lib/impact"
import type { RouteOption } from "@/lib/routing"

type RouteCardProps = {
  route: RouteOption
  selected: boolean
  onSelect: () => void
}

const LEVEL_LABEL = { low: "Low", medium: "Medium", high: "High" } as const

export function RouteCard({ route, selected, onSelect }: RouteCardProps) {
  const isFast = route.id === "fast"
  const exposure = route.exposure
  return (
    <button
      type="button"
      className={`route-card${selected ? " is-selected" : ""}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="route-card-head">
        <span className={`route-swatch route-swatch-${route.id}`} aria-hidden="true" />
        <span className="route-card-name">{route.name}</span>
        <span className="route-card-min">{route.minutes} min</span>
      </span>
      <span className="route-card-line">
        {format1(route.km)} km · {Math.round(route.busy * 100)}% on busy roads
        {isFast ? " · no air check" : " · tuned to you"}
      </span>
      <span className="route-card-line">
        CO₂ 0 kg · driving it: {format1((route.drivingCo2g ?? kgSaved(route.km) * 1000) / 1000)} kg
      </span>
      {exposure ? (
        <span className="exposure-row">
          <span className="exposure-name">Exposure score</span>
          <span className="exposure-meter" aria-hidden="true">
            <span
              className={`exposure-fill exposure-${exposure.level}`}
              style={{ width: `${Math.max(4, exposure.score)}%` }}
            />
          </span>
          <span className={`exposure-chip exposure-${exposure.level}`}>
            {exposure.score}/100 · {LEVEL_LABEL[exposure.level]}
          </span>
        </span>
      ) : null}
    </button>
  )
}
