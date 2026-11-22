const STEPS = [0, 1, 2, 3, 4, 5]

export function Footsteps({ label = "Personalizing your routes…" }: { label?: string }) {
  return (
    <div className="footsteps" role="status" aria-live="polite">
      <svg className="footsteps-svg" viewBox="0 0 220 90" aria-hidden="true">
        {STEPS.map((i) => (
          <g key={i} transform={`translate(${24 + i * 32} ${i % 2 === 0 ? 30 : 60}) rotate(90)`}>
            <g className="footstep" style={{ animationDelay: `${i * 0.25}s` }}>
              <ellipse cx="0" cy="-7" rx="6.5" ry="8.5" />
              <ellipse cx="0" cy="8" rx="5" ry="5.5" />
            </g>
          </g>
        ))}
      </svg>
      <p className="footsteps-label">{label}</p>
    </div>
  )
}
