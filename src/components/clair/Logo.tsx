export const PIN_PATH = "M40 76C40 76 14 50 14 32A26 26 0 0 1 66 32C66 50 40 76 40 76Z"
export const LEAF_PATH = "M28 42C28 27 43 22 53 24C53 37 46 46 28 42Z"
export const VEIN_PATH = "M28 42L40 31"

type LogoProps = {
  size: number
  leaf?: string
  className?: string
}

export function Logo({ size, leaf = "var(--leaf)", className }: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 80"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path d={PIN_PATH} fill="var(--pin)" />
      <path d={LEAF_PATH} fill={leaf} />
      <path d={VEIN_PATH} stroke="var(--pin)" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  )
}
