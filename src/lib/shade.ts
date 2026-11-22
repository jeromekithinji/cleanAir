/**
 * Shade estimate from road class.
 * This graph has no tree-canopy layer, so wide roads stand in for time in the sun.
 * motorway, trunk, primary, and secondary count as unshaded.
 */

const OPEN_ROADS = new Set(["motorway", "trunk", "primary", "secondary"])

export interface ShadeEstimate {
	unshadedMinutes: number
	shadePct: number
}

function metresBetween (
	a: number[],
	b: number[],
): number {
	const lat = ((a[1] + b[1]) / 2) * (Math.PI / 180)
	const dx = (b[0] - a[0]) * 111320 * Math.cos(lat)
	const dy = (b[1] - a[1]) * 110540
	return Math.hypot(dx, dy)
}

export function shadeFromRoadClass (
	coordinates: number[][],
	roadClass: Array<[number, number, string]> | undefined,
	durationSeconds: number,
): ShadeEstimate | null {
	if (!roadClass?.length || coordinates.length < 2 || durationSeconds <= 0) {
		return null
	}
	let total = 0
	let open = 0
	for (const [from, to, name] of roadClass) {
		let length = 0
		const end = Math.min(to, coordinates.length - 1)
		for (let index = from; index < end; index += 1) {
			length += metresBetween(coordinates[index], coordinates[index + 1])
		}
		total += length
		if (OPEN_ROADS.has(String(name).toLowerCase())) {
			open += length
		}
	}
	if (total <= 0) {
		return null
	}
	const share = open / total
	const minutes = durationSeconds / 60
	return {
		unshadedMinutes: Math.round(share * minutes * 10) / 10,
		shadePct: Math.round((1 - share) * 1000) / 10,
	}
}
