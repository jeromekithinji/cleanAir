"use client"

import { useEffect } from "react"
import { celebrate } from "@/lib/confetti"
import { format1, type Mode } from "@/data/mock"
import { useAccount } from "@/lib/account"
import { CAR_KG_PER_KM, gasolineLitres, phoneCharges, treeDays } from "@/lib/impact"
import type { RouteId } from "@/lib/routing"

type ImpactCardProps = {
  mode: Mode
  km: number
  route: RouteId
  kg: number
  sessionKg: number
  onDone: () => void
}

export function ImpactCard({ mode, km, route, kg, sessionKg, onDone }: ImpactCardProps) {
  const account = useAccount()
  const total = account.signedIn
    ? `${account.name}, your total: ${format1(account.co2Kg)} kg across ${account.trips} ${account.trips === 1 ? "trip" : "trips"}.`
    : `Total this session: ${format1(sessionKg)} kg.`

  useEffect(() => {
    celebrate()
  }, [])

  return (
    <div className="impact">
      <h2 id="clair-impact-title" className="impact-title">
        Trip complete
      </h2>
      <p className="impact-sub">
        You {mode === "bike" ? "biked" : "walked"} {format1(km)} km on the{" "}
        {route === "fast" ? "fastest" : "cleaner-air"} route. Driving the same distance would have released{" "}
        {format1(kg)} kg of CO₂.
      </p>
      <div className="impact-hero">
        <div className="impact-number">{format1(kg)}</div>
        <div className="impact-unit">kg of CO₂ saved</div>
      </div>
      <p className="impact-same">That&apos;s about the same as</p>
      <div className="impact-tiles">
        <div className="impact-tile">
          <div className="impact-tile-num">{phoneCharges(kg)}</div>
          <div className="impact-tile-cap">smartphone charges</div>
        </div>
        <div className="impact-tile">
          <div className="impact-tile-num">{treeDays(kg)}</div>
          <div className="impact-tile-cap">days of CO₂ a mature tree absorbs</div>
        </div>
        <div className="impact-tile">
          <div className="impact-tile-num">{gasolineLitres(kg)}</div>
          <div className="impact-tile-cap">of gasoline not burned</div>
        </div>
      </div>
      <p className="impact-foot">
        {total} Estimates: an average car emits {CAR_KG_PER_KM} kg CO₂ per km, a phone
        charge about 8 g, a mature tree absorbs about 22 kg a year, and gasoline releases about 2.3 kg per litre.
        Walking and biking produce no tailpipe emissions.
      </p>
      <button type="button" className="btn-primary" onClick={onDone}>
        Done
      </button>
    </div>
  )
}