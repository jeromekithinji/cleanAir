"use client"

import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react"
import { Bot, X } from "lucide-react"
import type {
	AssistantHint,
	AssistantReply,
	ChatMessage,
	ConditionsReply,
	DirectionsReply,
	ParsedTrip,
	SavedProfile,
} from "@/lib/assistant-types"
import type { Place, Sensitivity } from "@/lib/types"

const CARDS: Array<{
	hint: AssistantHint
	label: string
	placeholder: string
}> = [
	{
		hint: "directions",
		label: "Get directions",
		placeholder: "Biking to Atwater Market this afternoon",
	},
	{
		hint: "conditions",
		label: "Check conditions",
		placeholder: "Is it okay to go for a run with asthma right now?",
	},
	{
		hint: "places",
		label: "Find somewhere to go",
		placeholder: "Where can I go this evening that's good for my asthma?",
	},
]

const LEVELS: Sensitivity[] = ["low", "medium", "high"]

interface AssistantChatProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	messages: ChatMessage[]
	loadingLabel: string | null
	hint: AssistantHint | null
	onHint: (hint: AssistantHint) => void
	profile: SavedProfile | null
	onProfile: (profile: SavedProfile) => void
	onSend: (message: string) => void
	onRevise: (messageId: string, parsed: ParsedTrip) => void
	userLocation: Place | null
}

export function AssistantChat ({
	open,
	onOpenChange,
	messages,
	loadingLabel,
	hint,
	onHint,
	profile,
	onProfile,
	onSend,
	onRevise,
	userLocation,
}: AssistantChatProps) {
	const buttonRef = useRef<HTMLButtonElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)
	const profileRef = useRef<HTMLButtonElement>(null)
	const listRef = useRef<HTMLDivElement>(null)
	const wasOpen = useRef(false)

	useEffect(() => {
		if (open) {
			if (profile) {
				inputRef.current?.focus()
			} else {
				profileRef.current?.focus()
			}
			wasOpen.current = true
			return
		}
		if (wasOpen.current) {
			buttonRef.current?.focus()
		}
		wasOpen.current = false
	}, [open, profile])

	useEffect(() => {
		if (!open) {
			return
		}
		function handleKey (event: KeyboardEvent) {
			if (event.key === "Escape") {
				onOpenChange(false)
			}
		}
		window.addEventListener("keydown", handleKey)
		return () => window.removeEventListener("keydown", handleKey)
	}, [open, onOpenChange])

	useEffect(() => {
		const list = listRef.current
		if (list) {
			list.scrollTop = list.scrollHeight
		}
	}, [messages, loadingLabel, open])

	const placeholder =
		CARDS.find((card) => card.hint === hint)?.placeholder ??
		"Ask about a trip or the air"

	function handleSubmit (event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const input = inputRef.current
		const text = input?.value.trim() ?? ""
		if (!text || loadingLabel) {
			return
		}
		if (input) {
			input.value = ""
		}
		onSend(text)
	}

	return (
		<div className="fixed bottom-4 right-4 z-20">
			<div
				className={`absolute bottom-16 right-0 flex h-[520px] w-[min(380px,calc(100vw-2rem))] origin-bottom-right flex-col overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.18)] transition duration-200 ${
					open
						? "scale-100 opacity-100"
						: "pointer-events-none scale-95 opacity-0"
				}`}
				aria-hidden={!open}
				inert={!open}
			>
				<header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
					<h2 className="text-sm font-semibold text-zinc-900">
						Clean-air assistant
					</h2>
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						aria-label="Close assistant"
						className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100"
					>
						<X size={16} />
					</button>
				</header>
				<div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
					{profile ? (
						<Conversation
							messages={messages}
							loadingLabel={loadingLabel}
							onHint={(next) => {
								onHint(next)
								inputRef.current?.focus()
							}}
							onRevise={onRevise}
							userLocation={userLocation}
						/>
					) : (
						<ProfileForm firstButtonRef={profileRef} onSave={onProfile} />
					)}
				</div>
				<form onSubmit={handleSubmit} className="border-t border-zinc-100 p-3">
					<label className="sr-only" htmlFor="assistant-input">
						Message the assistant
					</label>
					<input
						id="assistant-input"
						ref={inputRef}
						disabled={!profile || Boolean(loadingLabel)}
						placeholder={placeholder}
						autoComplete="off"
						className="h-11 w-full rounded-full border border-zinc-200 px-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 disabled:bg-zinc-50"
					/>
				</form>
			</div>
			<div className="group relative">
				{!open ? (
					<span className="pointer-events-none absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-zinc-900 px-3 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
						Ask the assistant
					</span>
				) : null}
				<button
					ref={buttonRef}
					type="button"
					onClick={() => onOpenChange(!open)}
					aria-label={open ? "Close assistant" : "Open assistant"}
					title={open ? "Close assistant" : "Ask the assistant"}
					className="grid h-14 w-14 place-items-center rounded-full bg-[#0f766e] text-white shadow-lg"
				>
					{open ? <X size={22} /> : <Bot size={22} />}
				</button>
			</div>
		</div>
	)
}

function Conversation ({
	messages,
	loadingLabel,
	onHint,
	onRevise,
	userLocation,
}: {
	messages: ChatMessage[]
	loadingLabel: string | null
	onHint: (hint: AssistantHint) => void
	onRevise: (messageId: string, parsed: ParsedTrip) => void
	userLocation: Place | null
}) {
	if (messages.length === 0) {
		return (
			<div>
				<p className="text-sm text-zinc-700">
					Hi. I can plan a cleaner route, check today&apos;s air and heat, or
					suggest the kind of place to head to.
				</p>
				{!userLocation ? (
					<p className="mt-2 text-xs text-zinc-500">
						Allow location when the browser asks, so routes can start from
						where you are.
					</p>
				) : null}
				<div className="mt-3 grid gap-2">
					{CARDS.map((card) => (
						<button
							key={card.hint}
							type="button"
							onClick={() => onHint(card.hint)}
							className="rounded-xl border border-zinc-200 px-3 py-2 text-left text-sm font-medium text-zinc-900 hover:bg-zinc-50"
						>
							{card.label}
						</button>
					))}
				</div>
			</div>
		)
	}
	return (
		<>
			{messages.map((message) =>
				message.role === "user" ? (
					<p
						key={message.id}
						className="ml-8 rounded-2xl bg-zinc-900 px-3 py-2 text-sm text-white"
					>
						{message.text}
					</p>
				) : (
					<AssistantBubble
						key={message.id}
						message={message}
						onRevise={onRevise}
					/>
				),
			)}
			{loadingLabel ? (
				<p className="mr-8 w-fit rounded-2xl bg-zinc-100 px-3 py-2 text-sm text-zinc-500">
					{loadingLabel}
				</p>
			) : null}
		</>
	)
}

function AssistantBubble ({
	message,
	onRevise,
}: {
	message: ChatMessage
	onRevise: (messageId: string, parsed: ParsedTrip) => void
}) {
	const reply = message.reply
	if (!reply) {
		return null
	}
	return (
		<div className="mr-6 rounded-2xl bg-zinc-100 px-3 py-2 text-sm text-zinc-800">
			{reply.kind === "clarify" ? <p>{reply.question}</p> : null}
			{reply.kind === "directions" ? (
				<DirectionsBody
					reply={reply}
					onRevise={(parsed) => onRevise(message.id, parsed)}
				/>
			) : null}
			{reply.kind === "conditions" ? <ConditionsBody reply={reply} /> : null}
		</div>
	)
}

function DirectionsBody ({
	reply,
	onRevise,
}: {
	reply: DirectionsReply
	onRevise: (parsed: ParsedTrip) => void
}) {
	return (
		<div>
			<p>{reply.explanation}</p>
			<p className="mt-2 text-xs font-medium text-zinc-500">Understood as</p>
			<div className="mt-1 flex flex-wrap gap-2">
				<label className="text-xs text-zinc-600">
					To
					<input
						defaultValue={reply.parsed.toText ?? ""}
						onBlur={(event) => {
							const toText = event.target.value.trim()
							if (toText && toText !== reply.parsed.toText) {
								onRevise({ ...reply.parsed, toText })
							}
						}}
						className="ml-1 h-7 rounded-full border border-zinc-200 bg-white px-2 text-xs text-zinc-900"
					/>
				</label>
				<label className="text-xs text-zinc-600">
					Mode
					<select
						value={reply.parsed.mode ?? ""}
						onChange={(event) => {
							const mode = event.target.value
							onRevise({
								...reply.parsed,
								mode: mode === "walk" || mode === "bike" ? mode : null,
							})
						}}
						className="ml-1 h-7 rounded-full border border-zinc-200 bg-white px-2 text-xs"
					>
						<option value="">Any</option>
						<option value="walk">Walk</option>
						<option value="bike">Bike</option>
					</select>
				</label>
				<label className="text-xs text-zinc-600">
					When
					<select
						value={reply.parsed.timeOfDay ?? ""}
						onChange={(event) => {
							const timeOfDay = event.target.value
							onRevise({
								...reply.parsed,
								timeOfDay:
									timeOfDay === "morning" ||
									timeOfDay === "afternoon" ||
									timeOfDay === "evening" ||
									timeOfDay === "now"
										? timeOfDay
										: null,
							})
						}}
						className="ml-1 h-7 rounded-full border border-zinc-200 bg-white px-2 text-xs"
					>
						<option value="">Anytime</option>
						<option value="now">Now</option>
						<option value="morning">Morning</option>
						<option value="afternoon">Afternoon</option>
						<option value="evening">Evening</option>
					</select>
				</label>
			</div>
		</div>
	)
}

function ConditionsBody ({ reply }: { reply: ConditionsReply }) {
	const heat = reply.conditions.heatWarning ? "Heat warning" : "No heat warning"
	return (
		<div>
			<p>{reply.answer}</p>
			<p className="mt-2 text-xs text-zinc-600">
				{reply.conditions.airLevel === "unknown"
					? "Air reading unavailable"
					: `IQA ${reply.conditions.aqi} · ${reply.conditions.levelLabel}`}
				{" · "}
				Feels like {reply.conditions.feelsLikeC}°C
				{" · "}
				{heat}
			</p>
			{reply.sources.length > 0 ? (
				<div className="mt-2">
					<p className="text-xs font-medium text-zinc-500">Based on:</p>
					<ul className="mt-1 space-y-1">
						{reply.sources.map((source) => (
							<li key={source.id}>
								<a
									href={source.url}
									target="_blank"
									rel="noreferrer"
									className="text-xs text-[#0f766e] underline"
								>
									{source.source}
								</a>
							</li>
						))}
					</ul>
				</div>
			) : null}
			<p className="mt-2 text-[11px] text-zinc-500">{reply.note}</p>
		</div>
	)
}

function ProfileForm ({
	firstButtonRef,
	onSave,
}: {
	firstButtonRef: RefObject<HTMLButtonElement | null>
	onSave: (profile: SavedProfile) => void
}) {
	const [draft, setDraft] = useState<SavedProfile>({
		asthma: null,
		copd: null,
		heat: null,
	})

	function handleSubmit (event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		onSave(draft)
	}

	function toggle (field: keyof SavedProfile, level: Sensitivity) {
		setDraft((current) => ({
			...current,
			[field]: current[field] === level ? null : level,
		}))
	}

	return (
		<form onSubmit={handleSubmit}>
			<p className="text-sm text-zinc-700">
				Rank any conditions you have. Leave the rest blank, or skip this
				for general advice based on the weather.
			</p>
			<RankField
				name="Asthma"
				value={draft.asthma}
				firstButtonRef={firstButtonRef}
				onChoose={(level) => toggle("asthma", level)}
			/>
			<RankField
				name="Heat sensitivity"
				value={draft.heat}
				onChoose={(level) => toggle("heat", level)}
			/>
			<RankField
				name="COPD"
				value={draft.copd}
				onChoose={(level) => toggle("copd", level)}
			/>
			<div className="mt-4 flex gap-2">
				<button
					type="submit"
					className="h-9 rounded-full bg-zinc-900 px-4 text-sm text-white"
				>
					Continue
				</button>
				<button
					type="button"
					onClick={() =>
						onSave({ asthma: null, copd: null, heat: null })
					}
					className="h-9 rounded-full border border-zinc-200 px-4 text-sm text-zinc-700"
				>
					Skip
				</button>
			</div>
		</form>
	)
}

function RankField ({
	name,
	value,
	firstButtonRef,
	onChoose,
}: {
	name: string
	value: Sensitivity | null
	firstButtonRef?: RefObject<HTMLButtonElement | null>
	onChoose: (level: Sensitivity) => void
}) {
	return (
		<fieldset className="mt-3">
			<legend className="text-xs font-medium text-zinc-500">{name}</legend>
			<div className="mt-1 flex gap-2">
				{LEVELS.map((level, index) => (
					<button
						key={level}
						ref={index === 0 ? firstButtonRef : undefined}
						type="button"
						aria-pressed={value === level}
						onClick={() => onChoose(level)}
						className={`h-8 rounded-full border px-3 text-xs capitalize ${
							value === level
								? "border-zinc-900 bg-zinc-900 text-white"
								: "border-zinc-200 text-zinc-800"
						}`}
					>
						{level}
					</button>
				))}
			</div>
		</fieldset>
	)
}
