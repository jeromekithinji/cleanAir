import { AssistantUnavailable, handleAssistant } from "@/lib/assistant"
import type { AssistantRequestBody } from "@/lib/assistant-types"

export async function POST (request: Request) {
	let body: AssistantRequestBody
	try {
		body = (await request.json()) as AssistantRequestBody
	} catch {
		return Response.json({ error: "Invalid JSON" }, { status: 400 })
	}
	if (!body.profile || !body.message?.trim()) {
		return Response.json(
			{ error: "A message and a profile are required." },
			{ status: 400 },
		)
	}
	try {
		const reply = await handleAssistant(body)
		return Response.json(reply)
	} catch (error) {
		if (error instanceof AssistantUnavailable) {
			return Response.json({ error: error.message }, { status: error.status })
		}
		return Response.json({ error: "The assistant failed." }, { status: 503 })
	}
}
