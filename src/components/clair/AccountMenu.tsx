"use client"

import { useEffect, useRef } from "react"
import { UserIcon } from "./icons"

type AccountMenuProps = {
  open: boolean
  onToggle: () => void
  onClose: () => void
}

export function AccountMenu({ open, onToggle, onClose }: AccountMenuProps) {
  const wrapRef = useRef<HTMLDivElement>(null)

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
        aria-label="Account"
        aria-expanded={open}
        aria-controls="clair-account"
        onClick={onToggle}
      >
        <UserIcon size={22} />
      </button>
      {open && (
        <div id="clair-account" className="account-pop" role="status">
          Sign-in isn&apos;t part of this prototype. Your health info stays on this page only.
        </div>
      )}
    </div>
  )
}
