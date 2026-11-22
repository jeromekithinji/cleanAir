/**
 * Prototype account: a name and a running CO₂ total, kept in this browser only
 * (localStorage). No server, no password. Everyone starts signed in as the demo
 * user; "Sign out" clears the total from the device, "Sign in" brings the demo
 * user back.
 *
 * Components read it with useAccount(); the store notifies them on every change.
 */

import { useSyncExternalStore } from "react"

export type Account = {
  signedIn: boolean
  name: string
  /** CO₂ not emitted, compared with driving the same trips. */
  co2Kg: number
  trips: number
  /** Distance walked or biked on finished trips. */
  km: number
}

const KEY = "clair-account"

/** The name shown for the prototype's signed-in user. */
export const DEMO_NAME = "Jerome Kavinski"

export const SIGNED_OUT: Account = { signedIn: false, name: "", co2Kg: 0, trips: 0, km: 0 }
const DEMO: Account = { signedIn: true, name: DEMO_NAME, co2Kg: 0, trips: 0, km: 0 }

const listeners = new Set<() => void>()
let cached: Account | null = null

function load(): Account {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) {
      // First visit: signed in as the demo user.
      return DEMO
    }
    const saved = JSON.parse(raw) as Partial<Account>
    if (saved.signedIn !== true) {
      return SIGNED_OUT
    }
    return {
      signedIn: true,
      // The name is not editable in the prototype, so always use the current one.
      name: DEMO_NAME,
      co2Kg: positive(saved.co2Kg),
      trips: Math.round(positive(saved.trips)),
      km: positive(saved.km),
    }
  } catch {
    return DEMO
  }
}

function positive(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0
}

function save(next: Account) {
  cached = next
  try {
    // Signed out is saved too, so a refresh does not sign the demo user back in.
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Private mode or storage full: keep it for this page only.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another tab signed in or out.
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      cached = load()
      listener()
    }
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

function snapshot(): Account {
  cached ??= load()
  return cached
}

/** The current account; the demo user on the server and before the page loads. */
export function useAccount(): Account {
  return useSyncExternalStore(subscribe, snapshot, () => DEMO)
}

/** Signs the demo user back in, starting from a zero total. */
export function signIn(name: string = DEMO_NAME) {
  const clean = name.trim().slice(0, 40) || DEMO_NAME
  save({ ...DEMO, name: clean })
}

/** Clears the name and the CO₂ total from this device. */
export function signOut() {
  save(SIGNED_OUT)
}

/** Adds a finished trip to the total. Does nothing when signed out. */
export function addTrip(km: number, co2Kg: number) {
  const current = snapshot()
  if (!current.signedIn) {
    return
  }
  save({
    ...current,
    trips: current.trips + 1,
    km: current.km + km,
    co2Kg: current.co2Kg + co2Kg,
  })
}
