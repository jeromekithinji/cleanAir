import { format1 } from "@/data/mock"
import { kgSaved } from "@/lib/impact"
import type { RouteOption } from "@/lib/routing"

type RouteCardProps = {
  route: RouteOption
  selected: boolean
  onSelect: () => void
  showBusy: boolean
}

export function RouteCard({ route, selected, onSelect, showBusy }: RouteCardProps) {
  const isFast = route.id === "fast"
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
        {format1(route.km)} km{showBusy ? ` · ${Math.round(route.busy * 100)}% on busy roads` : ""}
        {isFast ? " · no air check" : " · best route"}
      </span>
      <span className="route-card-line">
        CO₂ 0 kg · driving it: {format1((route.drivingCo2g ?? kgSaved(route.km) * 1000) / 1000)} kg
      </span>
    </button>
  )
}

