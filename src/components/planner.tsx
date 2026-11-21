"use client"

import { useEffect, useState } from "react"
import { AssistantPanel } from "@/components/assistant-panel"
import { ConditionsBanner } from "@/components/conditions-banner"
import { HealthProfileForm } from "@/components/health-profile"
import { ImpactCard } from "@/components/impact-card"
import { RouteCompare } from "@/components/route-compare"
import { RouteMap } from "@/components/route-map"
import { TripSearch } from "@/components/trip-search"
import { getHealth } from "@/lib/api"
import type {
  AssistantResponse,
  HealthProfile,
  Place,
  RoutesResponse,
} from "@/lib/types"

export function Planner() {
  const [profile, setProfile] = useState<HealthProfile | null>(null)
  const [apiStatus, setApiStatus] = useState("Checking API…")
  const [poorAir, setPoorAir] = useState(false)
  const [origin, setOrigin] = useState<Place | null>(null)
  const [routes, setRoutes] = useState<RoutesResponse | null>(null)
  const [selectedId, setSelectedId] = useState<"fast" | "clean" | null>(null)

  useEffect(() => {
    getHealth()
      .then(() => setApiStatus("API connected"))
      .catch(() => setApiStatus("API offline"))
  }, [])

  function handleRoutes(
    nextOrigin: Place,
    _destination: Place,
    nextRoutes: RoutesResponse,
  ) {
    setOrigin(nextOrigin)
    setRoutes(nextRoutes)
    setSelectedId(nextRoutes.routes[0]?.id ?? null)
  }

  function handleAssistant(result: AssistantResponse) {
    if (result.origin) {
      setOrigin(result.origin)
    }
    if (result.routes) {
      setRoutes(result.routes)
      setSelectedId(result.routes.routes[0]?.id ?? null)
    }
  }

  const selected =
    routes?.routes.find((route) => route.id === selectedId) ?? null

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium">Clean Air</p>
        <p className="text-xs text-zinc-500">{apiStatus}</p>
      </header>
      {profile === null ? (
        <HealthProfileForm onContinue={setProfile} />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {profile.mode === "walk" ? "Walking" : "Biking"} · asthma{" "}
              {profile.asthma} · COPD {profile.copd} · heat {profile.heat}
            </p>
            <button
              type="button"
              onClick={() => setProfile(null)}
              className="text-sm underline"
            >
              Edit profile
            </button>
          </div>
          <ConditionsBanner
            origin={origin}
            profile={profile}
            poorAir={poorAir}
          />
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <TripSearch
                profile={profile}
                poorAir={poorAir}
                onPoorAirChange={setPoorAir}
                onResult={handleRoutes}
              />
            </section>
            <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <AssistantPanel
                profile={profile}
                origin={origin}
                poorAir={poorAir}
                onResult={handleAssistant}
              />
            </section>
          </div>
          <RouteMap routes={routes?.routes ?? []} selectedId={selectedId} />
          <RouteCompare
            tradeoff={routes?.tradeoff ?? null}
            routes={routes?.routes ?? []}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <ImpactCard route={selected} />
        </div>
      )}
    </main>
  )
}
