import type { RouteOption } from "@/lib/types"

interface RouteCompareProps {
  tradeoff: string | null
  routes: RouteOption[]
  selectedId: "fast" | "clean" | null
  onSelect: (id: "fast" | "clean") => void
}

export function RouteCompare({
  tradeoff,
  routes,
  selectedId,
  onSelect,
}: RouteCompareProps) {
  if (routes.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Two routes will sit side by side: the fastest, and a cleaner one that
        may take a few more minutes.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {tradeoff ? <p className="text-sm font-medium">{tradeoff}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {routes.map((route) => {
          const minutes = Math.round(route.duration_seconds / 60)
          const km = (route.distance_meters / 1000).toFixed(1)
          const busy = Math.round(route.busy_share * 100)
          const selected = route.id === selectedId
          return (
            <button
              key={route.id}
              type="button"
              onClick={() => onSelect(route.id)}
              className={`rounded-2xl border p-4 text-left ${
                selected
                  ? "border-zinc-900 dark:border-zinc-100"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <p className="font-medium">{route.label}</p>
              <p className="mt-2 text-sm">
                {minutes} min · {km} km · {busy}% on busy roads
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Trip CO₂ {route.trip_co2_g} g · driving {route.driving_co2_g} g
              </p>
              {route.explanations.length > 0 ? (
                <ul className="mt-2 list-disc pl-4 text-sm">
                  {route.explanations.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
