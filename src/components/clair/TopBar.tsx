"use client"

import type { ComponentProps } from "react"
import { APP_NAME } from "@/data/mock"
import { AccountMenu } from "./AccountMenu"
import { PulseIcon } from "./icons"
import { Logo } from "./Logo"
import { SearchBox } from "./SearchBox"

type TopBarProps = {
  search: ComponentProps<typeof SearchBox>
  onHealth: () => void
  accountOpen: boolean
  onAccountToggle: () => void
  onAccountClose: () => void
}

export function TopBar({ search, onHealth, accountOpen, onAccountToggle, onAccountClose }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="badge" aria-label={APP_NAME} role="img">
        <Logo size={28} />
      </div>
      <SearchBox {...search} />
      <div className="topbar-spacer" />
      <button type="button" className="health-btn" onClick={onHealth} aria-label="Health info">
        <PulseIcon size={20} />
        <span className="health-btn-label">Health info</span>
      </button>
      <AccountMenu open={accountOpen} onToggle={onAccountToggle} onClose={onAccountClose} />
    </header>
  )
}
