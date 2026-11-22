import { readLiveConditions } from "@/lib/read-live"

export async function GET (request: Request) {
	const url = new URL(request.url)
	const lat = Number(url.searchParams.get("lat") ?? "45.50884")
	const lon = Number(url.searchParams.get("lon") ?? "-73.58781")
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
		return Response.json({ error: "Invalid coordinates" }, { status: 400 })
	}
	const live = await readLiveConditions(lat, lon)
	return Response.json(live)
}
