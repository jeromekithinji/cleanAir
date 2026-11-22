"use client"

import { useEffect, useRef } from "react"
import { format1 } from "@/data/mock"
import { signIn, signOut, useAccount } from "@/lib/account"
import { LeafIcon, UserIcon } from "./icons"

type AccountMenuProps = {
  open: boolean
  onToggle: () => void
  onClose: () => void
  /** Opens the health info form. */
  onEditHealth: () => void
  /** Called after sign-out so the page can forget the health info too. */
  onSignedOut: () => void
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.[0] ?? ""
  return letters.toUpperCase()
}

export function AccountMenu({ open, onToggle, onClose, onEditHealth, onSignedOut }: AccountMenuProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const account = useAccount()

  useEffect(() => {
    if (!open) {
      return
    }
    const onDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [open, onClose])

  return (
    <div className="account" ref={wrapRef}>
      <button
        type="button"
        className="account-btn"
        aria-label={account.signedIn ? `Account: ${account.name}` : "Account: signed out"}
        aria-expanded={open}
        aria-controls="clair-account"
        onClick={onToggle}
      >
        {account.signedIn ? (
          <span className="account-initials" aria-hidden="true">
            {initials(account.name)}
          </span>
        ) : (
          <UserIcon size={22} />
        )}
      </button>
      {open && (
        <div id="clair-account" className="account-pop" role="dialog" aria-label="Your profile">
          {account.signedIn ? (
            <>
              <div className="profile-head">
                <span className="profile-avatar" aria-hidden="true">
                  {initials(account.name)}
                </span>
                <div className="profile-who">
                  <p className="profile-name">{account.name}</p>
                </div>
              </div>

              <div className="profile-co2">
                <p className="profile-co2-label">
                  <LeafIcon size={16} />
                  CO₂ saved
                </p>
                <p className="profile-co2-value">
                  {format1(account.co2Kg)} <span className="profile-co2-unit">kg</span>
                </p>
                <p className="profile-co2-detail">
                  {account.trips === 0
                    ? "Finish a trip to start counting."
                    : `${account.trips} ${account.trips === 1 ? "trip" : "trips"} · ${format1(account.km)} km not driven`}
                </p>
              </div>

              <button
                type="button"
                className="profile-row"
                onClick={() => {
                  onClose()
                  onEditHealth()
                }}
              >
                <span>Health info</span>
                <span className="profile-row-action">Edit ›</span>
              </button>

              <button
                type="button"
                className="profile-signout"
                onClick={() => {
                  signOut()
                  onSignedOut()
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <div className="profile-signin">
              <p className="profile-name">You&apos;re signed out</p>
              <p className="profile-note">
                Your CO₂ total was cleared from this device. Sign in to start a new one.
              </p>
              <button type="button" className="btn-primary profile-submit" onClick={() => signIn()}>
                Sign in
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
