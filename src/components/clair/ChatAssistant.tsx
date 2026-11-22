"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { APP_NAME } from "@/data/mock"
import type { ChatChip } from "@/lib/assistant"
import { ChatSparkIcon, CloseIcon, SendIcon } from "./icons"

export type ChatMessage = {
  id: number
  role: "user" | "assistant"
  text: string
  chips?: ChatChip[]
}

type ChatAssistantProps = {
  open: boolean
  onOpen: () => void
  onClose: () => void
  messages: ChatMessage[]
  onSend: (text: string) => void
}

const OPTIONS = ["Get directions", "Check conditions", "Find somewhere to go"]

export function ChatAssistant({ open, onOpen, onClose, messages, onSend }: ChatAssistantProps) {
  const [draft, setDraft] = useState("")
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
    onSend(text)
    setDraft("")
  }

  return (
    <>
      {open && (
        <section className="chat" role="dialog" aria-label={`${APP_NAME} assistant`}>
          <header className="chat-head">
            <div>
              <h2 className="chat-title">{APP_NAME} assistant</h2>
              <p className="chat-sub">Demo assistant, rule-based</p>
            </div>
            <button type="button" className="icon-btn" aria-label="Close assistant" onClick={onClose}>
              <CloseIcon size={22} />
            </button>
          </header>
          <div className="chat-list" ref={listRef} aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={`msg msg-${message.role}`}>
                <div className="msg-bubble">{message.text}</div>
                {message.chips && (
                  <div className="msg-chips">
                    {message.chips.map((chip) => (
                      <button key={chip.label} type="button" className="place-chip" onClick={() => onSend(chip.message)}>
                        {chip.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="chat-options">
            {OPTIONS.map((label) => (
              <button key={label} type="button" className="option-btn" onClick={() => onSend(label)}>
                {label}
              </button>
            ))}
          </div>
          <form className="chat-form" onSubmit={submit}>
            <input
              className="chat-input"
              value={draft}
              placeholder="Or type: bike to Atwater Market"
              aria-label="Message the assistant"
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className="chat-send" aria-label="Send">
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
