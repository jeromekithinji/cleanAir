"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { APP_NAME } from "@/data/mock"
import type { AssistantHint, GuidanceSource, ParsedTrip } from "@/lib/assistant-types"
import type { ChatChip } from "@/lib/clair-assistant"
import { ChatSparkIcon, CloseIcon, SendIcon } from "./icons"

export type ChatMessage = {
  id: number
  role: "user" | "assistant"
  text: string
  chips?: ChatChip[]
  pending?: boolean
  sources?: GuidanceSource[]
  note?: string
  parsed?: ParsedTrip
  hideAdvice?: boolean
}

type ChatAssistantProps = {
  open: boolean
  onOpen: () => void
  onClose: () => void
  messages: ChatMessage[]
  busy?: boolean
  onSend: (text: string, hint?: AssistantHint | null) => void
  onPick?: (hint: AssistantHint) => void
}

const OPTIONS: Array<{ label: string; hint: AssistantHint }> = [
  { label: "Get directions", hint: "directions" },
  { label: "Check conditions", hint: "conditions" },
  { label: "Find somewhere to go", hint: "places" },
]

const PLACEHOLDERS: Record<AssistantHint, string> = {
  directions: "Or type: bike to Atwater Market",
  conditions: "Or type: is the air okay for a walk?",
  places: "Or describe the kind of place you want",
}

export function ChatAssistant({ open, onOpen, onClose, messages, busy, onSend, onPick }: ChatAssistantProps) {
  const [draft, setDraft] = useState("")
  const [hint, setHint] = useState<AssistantHint | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (list) {
      list.scrollTop = list.scrollHeight
    }
  }, [messages, open])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text) {
      return
    }
    if (busy) {
      return
    }
    onSend(text, hint)
    setDraft("")
  }

  const pick = (next: AssistantHint) => {
    setHint(next)
    onPick?.(next)
  }

  return (
    <>
      {open && (
        <section className="chat" role="dialog" aria-label={`${APP_NAME} assistant`}>
          <header className="chat-head">
            <div>
              <h2 className="chat-title">{APP_NAME} assistant</h2>
              <p className="chat-sub">Live air, weather, and your route</p>
            </div>
            <button type="button" className="icon-btn" aria-label="Close assistant" onClick={onClose}>
              <CloseIcon size={22} />
            </button>
          </header>
          <div className="chat-list" ref={listRef} aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={`msg msg-${message.role}${message.pending ? " msg-pending" : ""}`}>
                <div className="msg-bubble">{message.text}</div>
                {message.note ? <p className="msg-note">{message.note}</p> : null}
                {message.role === "assistant" && !message.pending && message.id !== 0 && !message.hideAdvice && (
                  <p className="msg-note">General guidance, not medical advice.</p>
                )}
                {message.chips && (
                  <div className="msg-chips">
                    {message.chips.map((chip) => (
                      <button key={chip.label} type="button" className="place-chip" disabled={busy} onClick={() => onSend(chip.message)}>
                        {chip.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {!hint && !messages.some((message) => message.role === "user") && (
            <div className="chat-options">
              {OPTIONS.map((option) => (
                <button
                  key={option.hint}
                  type="button"
                  className="option-btn"
                  disabled={busy}
                  onClick={() => pick(option.hint)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          <form className="chat-form" onSubmit={submit}>
            <input
              className="chat-input"
              value={draft}
              placeholder={hint ? PLACEHOLDERS[hint] : "Type a message"}
              aria-label="Message the assistant"
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className="chat-send" aria-label="Send" disabled={busy || !draft.trim()}>
              <SendIcon size={20} />
            </button>
          </form>
        </section>
      )}
      <button
        type="button"
        className="chat-fab"
        aria-label={open ? "Close assistant" : "Open assistant"}
        aria-expanded={open}
        onClick={open ? onClose : onOpen}
      >
        <ChatSparkIcon size={30} />
      </button>
    </>
  )
}
