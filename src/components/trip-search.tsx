"use client"

import { useState, type FormEvent } from "react"
import { featureMessage, geocode, planRoutes } from "@/lib/api"
import type { HealthProfile, Place, RoutesResponse } from "@/lib/types"

interface TripSearchProps {
  profile: HealthProfile
  poorAir: boolean
  onPoorAirChange: (value: boolean) => void
  onResult: (origin: Place, destination: Place, routes: RoutesResponse) => void
}

export function TripSearch({
  profile,
  poorAir,
  onPoorAirChange,
  onResult,
}: TripSearchProps) {
  const [originQuery, setOriginQuery] = useState("")
  const [destinationQuery, setDestinationQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setMessage(null)
    try {
      const [originMatches, destinationMatches] = await Promise.all([
        geocode(originQuery),
        geocode(destinationQuery),
      ])
      const origin = originMatches.results[0]
      const destination = destinationMatches.results[0]
      if (!origin || !destination) {
        setMessage("No match for that address.")
        return
      }
      const routes = await planRoutes(origin, destination, profile, poorAir)
      onResult(origin, destination, routes)
    } catch (error) {
      setMessage(featureMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Trip</h2>
      <label className="flex flex-col gap-1 text-sm">
        Start
        <input
          required
          value={originQuery}
          onChange={(event) => setOriginQuery(event.target.value)}
          placeholder="Atwater Market"
          className="h-10 rounded-lg border border-zinc-200 px-3 dark:border-zinc-800"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Destination
        <input
          required
          value={destinationQuery}
          onChange={(event) => setDestinationQuery(event.target.value)}
          placeholder="Where you are going"
          className="h-10 rounded-lg border border-zinc-200 px-3 dark:border-zinc-800"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={poorAir}
          onChange={(event) => onPoorAirChange(event.target.checked)}
        />
        Treat the air as poor
      </label>
      <button
        type="submit"
        disabled={isLoading}
        className="h-10 rounded-full bg-zinc-900 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {isLoading ? "Searching…" : "Compare routes"}
      </button>
      {message ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
      ) : null}
    </form>
  )
}
