"use client"

import { useEffect, useRef, type ReactNode } from "react"

type ModalProps = {
  labelledBy: string
  variant?: "welcome"
  children: ReactNode
}

export function Modal({ labelledBy, variant, children }: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const card = cardRef.current
    if (!card) {
      return
    }
    const previous = document.activeElement as HTMLElement | null
    card.focus({ preventScroll: true })
    return () => previous?.focus?.({ preventScroll: true })
  }, [labelledBy])

  return (
    <div className="backdrop">
      <div
        ref={cardRef}
        className={`modal${variant === "welcome" ? " modal-welcome" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  )
}
