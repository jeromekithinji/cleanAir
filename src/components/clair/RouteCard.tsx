import { format1 } from "@/data/mock"
import { kgSaved } from "@/lib/impact"
import { formatMinutes, type RouteOption } from "@/lib/routing"

type RouteCardProps = {
  route: RouteOption
  selected: boolean
  onSelect: () => void
  showBusy: boolean
}

/** Time spent on busy roads, e.g. "2 min in busy areas". */
function busyTime(route: RouteOption): string {
  if (route.busy <= 0) return "no busy areas"
  const minutes = Math.round(route.minutes * route.busy)
  return minutes < 1 ? "under 1 min in busy areas" : `${formatMinutes(minutes)} in busy areas`
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
        <span className="route-card-min">{formatMinutes(route.minutes)}</span>
      </span>
      <span className="route-card-line">
        {format1(route.km)} km{showBusy ? ` · ${busyTime(route)}` : ""}
        {isFast ? " · no air check" : " · best route"}
      </span>
      <span className="route-card-line">
        Saving {format1((route.drivingCo2g ?? kgSaved(route.km) * 1000) / 1000)} kg CO₂
      </span>
    </button>
  )
}

