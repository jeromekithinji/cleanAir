"use client"

import { useState, type FormEvent } from "react"
import { askAssistant, featureMessage } from "@/lib/api"
import type {
  AssistantResponse,
  HealthProfile,
  Place,
} from "@/lib/types"

interface AssistantPanelProps {
  profile: HealthProfile
  origin: Place | null
  poorAir: boolean
  onResult: (result: AssistantResponse) => void
}

export function AssistantPanel({
  profile,
  origin,
  poorAir,
  onResult,
}: AssistantPanelProps) {
  const [message, setMessage] = useState("")
  const [reply, setReply] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setReply(null)
    try {
      const result = await askAssistant(message, profile, origin, poorAir)
      setReply(result.reply)
      onResult(result)
    } catch (error) {
      setReply(featureMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Trip assistant</h2>
      <label className="flex flex-col gap-1 text-sm">
        Ask in a sentence
        <textarea
          required
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={3}
          placeholder="I have asthma and want to bike to Atwater Market this afternoon"
          className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
        />
      </label>
      <button
        type="submit"
        disabled={isLoading}
        className="h-10 rounded-full border border-zinc-300 text-sm font-medium disabled:opacity-60 dark:border-zinc-700"
      >
        {isLoading ? "Asking…" : "Ask"}
      </button>
      {reply ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{reply}</p>
      ) : (
        <p className="text-sm text-zinc-500">
          Needs AI_GATEWAY_API_KEY. Route math still lives in the API, not in
          the model.
        </p>
      )}
    </form>
  )
}
