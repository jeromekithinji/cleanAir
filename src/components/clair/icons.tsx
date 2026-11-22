import type { ReactNode } from "react"

type IconProps = {
  size?: number
  strokeWidth?: number
  className?: string
}

function Svg({
  size = 20,
  strokeWidth = 2,
  className,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7.5" />
    <path d="m21 21-4.3-4.3" />
  </Svg>
)

export const ArrowRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </Svg>
)

export const SwapIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m21 16-4 4-4-4" />
    <path d="M17 20V4" />
    <path d="m3 8 4-4 4 4" />
    <path d="M7 4v16" />
  </Svg>
)

export const CircleIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="5" />
  </Svg>
)

export const PulseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M22 12h-4l-3 7-6-14-3 7H2" />
  </Svg>
)

export const UserIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </Svg>
)

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Svg>
)

export const WalkIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="13" cy="4" r="1.6" />
    <path d="M9.5 21 12 14.5l3 3V21" />
    <path d="M12 14.5 13 8.5" />
    <path d="M7.5 12 9.5 9l3.5-.5 2 3 3 1" />
  </Svg>
)

export const BikeIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="18.5" cy="17.5" r="3.5" />
    <circle cx="5.5" cy="17.5" r="3.5" />
    <circle cx="15" cy="5" r="1" />
    <path d="M12 17.5V14l-3-3 4-3 2 3h2" />
  </Svg>
)

export const WindIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12.8 19.6A2 2 0 1 0 14 16H2" />
    <path d="M17.5 8a2.5 2.5 0 1 1 2 4H2" />
    <path d="M9.8 4.4A2 2 0 1 1 11 8H2" />
  </Svg>
)

export const CloudIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 18h10a4 4 0 0 0 .4-8 6 6 0 0 0-11.5-1.5A3.5 3.5 0 0 0 7 18Z" />
  </Svg>
)

export const SunIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </Svg>
)

export const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
)

export const ChevronUpIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m18 15-6-6-6 6" />
  </Svg>
)

export const AtomIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="1" />
    <path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z" />
    <path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z" />
  </Svg>
)

export const TrendUpIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M22 7 13.5 15.5 8.5 10.5 2 17" />
    <path d="M16 7h6v6" />
  </Svg>
)

export const TrendDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M22 17 13.5 8.5 8.5 13.5 2 7" />
    <path d="M16 17h6v-6" />
  </Svg>
)

export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </Svg>
)

export const ThermometerIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
  </Svg>
)

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </Svg>
)

export const MinusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
)

export const SendIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 11 22 2l-9 19-2-8-8-2Z" />
  </Svg>
)

/** Exposure map: three waves rising off a road. */
export const ExposureIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 8c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0" />
    <path d="M3 13c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0" />
    <path d="M3 18c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0" />
  </Svg>
)

export function LocateIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" fill="none" stroke="var(--pop)" strokeWidth="2" />
      <circle cx="12" cy="12" r="5" fill="var(--pop)" />
    </svg>
  )
}

export function ChatSparkIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="clair-spark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8BA49A" />
          <stop offset="1" stopColor="var(--pop)" />
        </linearGradient>
      </defs>
      <path
        d="M17 6H8.5A3.5 3.5 0 0 0 5 9.5v10A3.5 3.5 0 0 0 8.5 23H11v4.5l5.5-4.5h7a3.5 3.5 0 0 0 3.5-3.5V15"
        fill="none"
        stroke="var(--pop)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24.5 2.5C25.1 6.2 26.8 7.9 30.5 8.5 26.8 9.1 25.1 10.8 24.5 14.5 23.9 10.8 22.2 9.1 18.5 8.5 22.2 7.9 23.9 6.2 24.5 2.5Z"
        fill="url(#clair-spark)"
      />
      <path
        d="M13 12C13.35 14.1 14.4 15.15 16.5 15.5 14.4 15.85 13.35 16.9 13 19 12.65 16.9 11.6 15.85 9.5 15.5 11.6 15.15 12.65 14.1 13 12Z"
        fill="#8BA49A"
      />
    </svg>
  )
}
