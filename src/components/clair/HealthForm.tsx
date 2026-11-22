import type { CSSProperties } from "react"
import { CONDITIONS, LEVEL_LABEL, type ConditionKey, type Health, type Level } from "@/data/mock"

type HealthFormProps = {
  health: Health
  onChange: (health: Health) => void
  onDone: () => void
}

export function HealthForm({ health, onChange, onDone }: HealthFormProps) {
  const toggle = (key: ConditionKey) => {
    onChange({ ...health, [key]: health[key] ? null : 1 })
  }

  const setLevel = (key: ConditionKey, level: Level) => {
    onChange({ ...health, [key]: level })
  }

  return (
    <div className="health">
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
      <button type="button" className="btn-primary" onClick={onDone}>
        Done
      </button>
    </div>
  )
}
