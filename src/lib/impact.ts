/** Average car tailpipe CO₂, kilograms per kilometre. Verify before launch. */
export const CAR_KG_PER_KM = 0.17

/** About 8 g CO₂ for one smartphone charge. Verify before launch. */
export const PHONE_CHARGE_KG = 0.00822

/** A mature tree absorbs about 22 kg CO₂ a year, treated here as 0.06 kg a day. Verify before launch. */
export const TREE_KG_PER_DAY = 0.06

/** Gasoline releases about 2.3 kg CO₂ per litre. Verify before launch. */
export const GASOLINE_KG_PER_LITRE = 2.3

export function kgSaved(km: number): number {
  return km * CAR_KG_PER_KM
}

export function phoneCharges(kg: number): number {
  return Math.round(kg / PHONE_CHARGE_KG)
}

export function treeDays(kg: number): string {
  const days = kg / TREE_KG_PER_DAY
  if (days < 10) {
    return (Math.round(days * 10) / 10).toFixed(1)
  }
  return String(Math.round(days))
}

export function gasolineLitres(kg: number): string {
  const litres = kg / GASOLINE_KG_PER_LITRE
  return `${(Math.round(litres * 10) / 10).toFixed(1)} L`
}
