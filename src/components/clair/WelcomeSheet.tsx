import { APP_NAME } from "@/data/mock"
import { ArrowRightIcon, PulseIcon } from "./icons"
import { Logo } from "./Logo"

type WelcomeSheetProps = {
  onAddHealth: () => void
  onSkip: () => void
}

export function WelcomeSheet({ onAddHealth, onSkip }: WelcomeSheetProps) {
  return (
    <div className="welcome">
      <Logo size={104} leaf="#fff" className="welcome-logo" />
      <div className="welcome-name">{APP_NAME}</div>
      <h1 id="clair-welcome-title" className="welcome-title">
        Routes that go easy on your lungs
      </h1>
      <p className="welcome-sub">
        Add your health info and we&apos;ll plan walking and biking routes that avoid busy, polluted roads.
      </p>
      <button type="button" className="welcome-cta" onClick={onAddHealth}>
        <PulseIcon size={22} className="welcome-cta-left" />
        Add health info
        <ArrowRightIcon size={22} className="welcome-cta-right" />
      </button>
      <button type="button" className="welcome-skip" onClick={onSkip}>
        Skip for now
      </button>
    </div>
  )
}
