import type {
  AirCategory,
  HealthProfile,
  Place,
  RoutesResponse,
} from "@/lib/types"

export function planHealthRoutes(
  origin: Place,
  destination: Place,
  profile: HealthProfile & { extraMinutesOk?: 5 | 10 | 15 | "flexible" },
  airLevel: AirCategory | undefined,
  feelsLikeC: number | null,
  heatWarning: boolean,
  signal?: AbortSignal,
): Promise<RoutesResponse> {
  return fetch("/api/route", {
    method: "POST",
    signal,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      origin,
      destination,
      profile,
      ...(airLevel && airLevel !== "unknown" ? { air_level: airLevel } : {}),
      feels_like_c: feelsLikeC,
      heat_warning: heatWarning,
    }),
  }).then(async (response) => {
    if (!response.ok) {
      let detail = ""
      try {
        const body = (await response.json()) as { detail?: unknown }
        if (typeof body.detail === "string") {
          detail = body.detail
        }
      } catch {
        detail = ""
      }
      throw new Error(detail || `Request failed (${response.status}).`)
    }
    return response.json() as Promise<RoutesResponse>
  })
}
