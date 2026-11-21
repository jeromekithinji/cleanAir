import type { RouteOption } from "@/lib/types"

interface ImpactCardProps {
  route: RouteOption | null
}

export function ImpactCard({ route }: ImpactCardProps) {
  if (!route) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Choose a route to see the CO₂ you save compared with driving.
      </p>
    )
  }

  const saved = Math.max(0, route.driving_co2_g - route.trip_co2_g)

  return (
    <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-sm font-medium">Impact</p>
      <p className="mt-1 text-sm">
        You save {saved} g of CO₂ compared with driving this trip.
      </p>
    </div>
  )
}
