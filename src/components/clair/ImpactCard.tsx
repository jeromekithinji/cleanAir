"use client"

import { useEffect } from "react"
import { celebrate } from "@/lib/confetti"
import { format1, type Mode } from "@/data/mock"
import { gasolineLitres, phoneCharges, treeDays } from "@/lib/impact"
import type { RouteId } from "@/lib/routing"
import { FuelIcon, PhoneIcon, TreeIcon } from "./icons"

type ImpactCardProps = {
  mode: Mode
  km: number
  route: RouteId
  kg: number
  sessionKg: number
  onDone: () => void
}

export function ImpactCard({ mode, km, route, kg, onDone }: ImpactCardProps) {
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
        {route === "fast" ? "fastest" : "cleaner-air"} route instead of driving.
      </p>
      <div className="impact-hero">
        <div className="impact-number">{format1(kg)} kg</div>
        <div className="impact-unit">of CO₂ kept out of the air</div>
      </div>
      <p className="impact-same">That&apos;s like:</p>
      <div className="impact-tiles">
        <div className="impact-tile">
          <span className="impact-tile-icon"><PhoneIcon size={26} /></span>
          <div className="impact-tile-num">{phoneCharges(kg)}</div>
          <div className="impact-tile-cap">phone charges</div>
        </div>
        <div className="impact-tile">
          <span className="impact-tile-icon"><TreeIcon size={26} /></span>
          <div className="impact-tile-num">{treeDays(kg)} days</div>
          <div className="impact-tile-cap">of a tree cleaning the air</div>
        </div>
        <div className="impact-tile">
          <span className="impact-tile-icon"><FuelIcon size={26} /></span>
          <div className="impact-tile-num">{gasolineLitres(kg)}</div>
          <div className="impact-tile-cap">of gas not burned</div>
        </div>
      </div>
      <button type="button" className="btn-primary" onClick={onDone}>
        Done
      </button>
    </div>
  )
}