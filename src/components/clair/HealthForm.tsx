"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import {
  CONDITIONS,
  LEVEL_LABEL,
  type ConditionKey,
  type ExtraMinutesOk,
  type Health,
  type Level,
} from "@/data/mock"
import { Footsteps } from "./Footsteps"

const PROCESSING_MS = 1800

type HealthFormProps = {
  health: Health
  onChange: (health: Health) => void
  onDone: () => void
}

export function HealthForm({ health, onChange, onDone }: HealthFormProps) {
  const [processing, setProcessing] = useState(false)
  const [lockedHeight, setLockedHeight] = useState<number | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const handleDone = () => {
    if (processing) {
      return
    }
    setLockedHeight(cardRef.current?.offsetHeight ?? null)
    setProcessing(true)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      onDone()
    }, PROCESSING_MS)
  }

  if (processing) {
    return (
      <div
        ref={cardRef}
        className="health"
        style={{
          minHeight: lockedHeight ?? undefined,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <Footsteps />
      </div>
    )
  }

  const toggle = (key: ConditionKey) => {
    onChange({ ...health, [key]: health[key] ? null : 1 })
  }

  const setLevel = (key: ConditionKey, level: Level) => {
    onChange({ ...health, [key]: level })
  }

  return (
    <div ref={cardRef} className="health">
      <h2 id="clair-health-title" className="health-title">
        Your health info
      </h2>
      <p className="health-sub">Pick what applies and how strongly. It isn&apos;t saved when you close this page.</p>
      <div className="chips">
        {CONDITIONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className="chip"
            aria-pressed={health[key] !== null}
            onClick={() => toggle(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="level-row">
        <div className="level-head">
          <span>Extra time for a healthier route</span>
        </div>
        <div className="chips" role="group" aria-label="Extra time">
          {([
            [5, "5 min"],
            [10, "10 min"],
            [15, "15 min"],
            ["flexible", "Flexible"],
          ] as Array<[ExtraMinutesOk, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-pressed={(health.extraMinutesOk ?? 10) === value}
              onClick={() => onChange({ ...health, extraMinutesOk: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {CONDITIONS.filter(({ key }) => health[key] !== null).map(({ key, label }) => {
        const level = health[key] as Level
        const id = `clair-level-${key}`
        return (
          <div key={key} className="level-row">
            <div className="level-head">
              <label htmlFor={id}>{label}</label>
              <span>{LEVEL_LABEL[level]}</span>
            </div>
            <input
              id={id}
              className="slider"
              type="range"
              min={1}
              max={3}
              step={1}
              value={level}
              aria-valuetext={LEVEL_LABEL[level]}
              style={{ "--p": `${((level - 1) / 2) * 100}%` } as CSSProperties}
              onChange={(event) => setLevel(key, Number(event.target.value) as Level)}
            />
            <div className="level-ticks" aria-hidden="true">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
            </div>
          </div>
        )
      })}
      <p className="health-hint">Routes aim to reduce time near heavy traffic. This isn&apos;t medical advice.</p>
      <button type="button" className="btn-primary" onClick={handleDone}>
        Done
      </button>
    </div>
  )
}
