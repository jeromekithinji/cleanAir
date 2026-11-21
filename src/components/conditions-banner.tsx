"use client"

import { useEffect, useState } from "react"
import { featureMessage, getConditions } from "@/lib/api"
import type {
  ConditionsResponse,
  HealthProfile,
  Place,
} from "@/lib/types"

interface ConditionsBannerProps {
  origin: Place | null
  profile: HealthProfile
  poorAir: boolean
}

const CATEGORY_CLASS: Record<string, string> = {
  good: "border-emerald-600 bg-emerald-50 text-emerald-950",
  acceptable: "border-amber-500 bg-amber-50 text-amber-950",
  poor: "border-red-600 bg-red-50 text-red-950",
  unknown: "border-zinc-200 bg-zinc-50 text-zinc-700",
}

export function ConditionsBanner({
  origin,
  profile,
  poorAir,
}: ConditionsBannerProps) {
  const [conditions, setConditions] = useState<ConditionsResponse | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!origin) {
      return
    }
    let cancelled = false
    getConditions(origin, profile, poorAir)
      .then((next) => {
        if (!cancelled) {
          setConditions(next)
          setMessage(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setConditions(null)
          setMessage(featureMessage(error))
        }
      })
    return () => {
      cancelled = true
    }
  }, [origin, profile, poorAir])

  if (!origin) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        Air quality and heat advice show up here after you search a trip.
      </p>
    )
  }

  if (message) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        {message}
      </p>
    )
  }

  if (!conditions) {
    return (
      <p className="rounded-xl border border-zinc-200 px-4 py-3 text-sm">
        Checking the nearest station…
      </p>
    )
  }

  const tone = CATEGORY_CLASS[conditions.air.category] ?? CATEGORY_CLASS.unknown

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${tone}`}>
      <p className="font-medium">{conditions.banner}</p>
      <p>
        {conditions.air.station_name}
        {conditions.air.neighbourhood
          ? ` · ${conditions.air.neighbourhood}`
          : ""}
        {conditions.air.iqa !== null ? ` · IQA ${conditions.air.iqa}` : ""}
      </p>
    </div>
  )
}
