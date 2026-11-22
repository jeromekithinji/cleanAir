import { readHeatGrid } from "@/lib/heat-grid"

/** Heat layer for the exposure map: feels-like temperature on a grid over Montréal. */
export async function GET () {
	try {
		return Response.json(await readHeatGrid())
	} catch {
		return Response.json({ error: "Heat data is unavailable right now." }, { status: 502 })
	}
}
