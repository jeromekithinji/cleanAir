import type { RouteOption } from "@/lib/types"

interface RouteMapProps {
  routes: RouteOption[]
  selectedId: "fast" | "clean" | null
}

export function RouteMap({ routes, selectedId }: RouteMapProps) {
  return (
    <div className="flex h-64 flex-col justify-between rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-950">
      <p className="text-sm font-medium">Map</p>
      {routes.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          The fastest route and the clean-air route will be drawn here.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {routes.map((route) => (
            <li key={route.id}>
              {route.label}: {route.geometry.coordinates.length} points
              {route.id === selectedId ? " · selected" : ""}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-zinc-500">
        Map drawing belongs in this file. Geometry is already on each route.
      </p>
    </div>
  )
}
