"use client"

import { useEffect, useState } from "react"
import { featureMessage, getAir } from "@/lib/api"
import type { AirSnapshot, Place } from "@/lib/types"

interface ConditionsBannerProps {
  origin: Place | null
}

const CATEGORY_CLASS: Record<string, string> = {
  good: "border-emerald-600 bg-emerald-50 text-emerald-950",
  acceptable: "border-amber-500 bg-amber-50 text-amber-950",
  poor: "border-red-600 bg-red-50 text-red-950",
  unknown: "border-zinc-200 bg-zinc-50 text-zinc-700",
}

export function ConditionsBanner({ origin }: ConditionsBannerProps) {
  const [air, setAir] = useState<AirSnapshot | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!origin) {
      return
    }
    let cancelled = false
    getAir(origin)
      .then((next) => {
        if (!cancelled) {
          setAir(next)
          setMessage(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAir(null)
          setMessage(featureMessage(error))
        }
      })
    return () => {
      cancelled = true
    }
  }, [origin])

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

  if (!air) {
    return (
      <p className="rounded-xl border border-zinc-200 px-4 py-3 text-sm">
        Checking the nearest station…
      </p>
    )
  }

  const tone = CATEGORY_CLASS[air.level] ?? CATEGORY_CLASS.unknown

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${tone}`}>
      <p className="font-medium">
        {air.level} air
        {air.neighbourhood ? ` in ${air.neighbourhood}` : ""}
      </p>
      <p>
        {air.station_name}
        {air.iqa !== null ? ` · IQA ${air.iqa}` : ""}
      </p>
    </div>
  )
}
