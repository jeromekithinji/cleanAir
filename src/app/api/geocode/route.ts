import { NextResponse } from "next/server"
import type { GeocodeHit } from "@/lib/geocode-place"

interface PhotonProperties {
  name?: string
  street?: string
  housenumber?: string
  district?: string
  locality?: string
  city?: string
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] }
  properties?: PhotonProperties
}

const PHOTON = "https://photon.komoot.io/api/"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const q = url.searchParams.get("q")?.trim() ?? ""
  const lang = url.searchParams.get("lang") === "fr" ? "fr" : "en"
  if (q.length < 3) {
    return NextResponse.json([] satisfies GeocodeHit[])
  }

  const params = new URLSearchParams({
    q,
    lat: "45.50",
    lon: "-73.57",
    bbox: "-73.98,45.40,-73.47,45.71",
    limit: "5",
    lang,
  })

  try {
    const response = await fetch(`${PHOTON}?${params.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    })
    if (!response.ok) {
      return NextResponse.json([] satisfies GeocodeHit[])
    }
    const body = (await response.json()) as { features?: PhotonFeature[] }
    const hits = uniqueHits((body.features ?? []).flatMap(toHit)).slice(0, 5)
    return NextResponse.json(hits)
  } catch {
    return NextResponse.json([] satisfies GeocodeHit[])
  }
}

function toHit(feature: PhotonFeature): GeocodeHit[] {
  const [lng, lat] = feature.geometry?.coordinates ?? []
  if (typeof lng !== "number" || typeof lat !== "number") {
    return []
  }
  const props = feature.properties ?? {}
  const street = [props.housenumber, props.street].filter(Boolean).join(" ")
  const area = props.district || props.locality || props.city || ""
  const name = props.name || street || area
  if (!name) {
    return []
  }
  return [
    {
      name,
      subtitle: [street, area].filter(Boolean).join(", "),
      lat,
      lng,
    },
  ]
}

/** Photon sometimes returns the same place more than once. */
function uniqueHits(hits: GeocodeHit[]): GeocodeHit[] {
  const seen = new Set<string>()
  return hits.filter((hit) => {
    const key = `${hit.lng},${hit.lat},${hit.name}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}
