"use client"

import { useState, type FormEvent } from "react"
import { SENSITIVITIES } from "@/lib/api"
import type { HealthProfile, Sensitivity, TravelMode } from "@/lib/types"

interface HealthProfileFormProps {
  onContinue: (profile: HealthProfile) => void
}

const LEVELS: { id: Sensitivity; label: string }[] = SENSITIVITIES.map(
  (id) => ({
    id,
    label: id === "medium" ? "Med" : id[0].toUpperCase() + id.slice(1),
  }),
)

export function HealthProfileForm({ onContinue }: HealthProfileFormProps) {
  const [asthma, setAsthma] = useState<Sensitivity>("medium")
  const [copd, setCopd] = useState<Sensitivity>("low")
  const [heat, setHeat] = useState<Sensitivity>("medium")
  const [mode, setMode] = useState<TravelMode>("walk")

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onContinue({ asthma, copd, heat, mode })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-lg flex-col gap-8"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Clean Air</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Tell us what bothers your breathing. This stays in this tab and is
          not saved.
        </p>
      </div>
      <LevelField label="Asthma" value={asthma} onChange={setAsthma} />
      <LevelField label="COPD" value={copd} onChange={setCopd} />
      <LevelField label="Heat sensitivity" value={heat} onChange={setHeat} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">How you travel</legend>
        <div className="grid grid-cols-2 gap-2">
          <Choice
            pressed={mode === "walk"}
            onClick={() => setMode("walk")}
            label="Walking"
          />
          <Choice
            pressed={mode === "bike"}
            onClick={() => setMode("bike")}
            label="Biking"
          />
        </div>
      </fieldset>
      <button
        type="submit"
        className="h-11 rounded-full bg-zinc-900 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Plan a trip
      </button>
    </form>
  )
}

function LevelField({
  label,
  value,
  onChange,
}: {
  label: string
  value: Sensitivity
  onChange: (value: Sensitivity) => void
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-3 gap-2">
        {LEVELS.map((level) => (
          <Choice
            key={level.id}
            pressed={value === level.id}
            onClick={() => onChange(level.id)}
            label={level.label}
          />
        ))}
      </div>
    </fieldset>
  )
}

function Choice({
  label,
  pressed,
  onClick,
}: {
  label: string
  pressed: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`h-10 rounded-full border text-sm ${
        pressed
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      {label}
    </button>
  )
}
