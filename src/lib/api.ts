import type {
  AirCategory,
  AssistantResponse,
  AirSnapshot,
  ConditionsResponse,
  GeocodeResponse,
  HealthProfile,
  Place,
  RoutesResponse,
  Sensitivity,
} from "@/lib/types"

export class FeatureNotReadyError extends Error {
  feature: string
  module: string

  constructor(feature: string, module: string, detail: string) {
    super(detail)
    this.name = "FeatureNotReadyError"
    this.feature = feature
    this.module = module
  }
}

interface NotReadyBody {
  feature?: string
  module?: string
  detail?: string
}

export function featureMessage(error: unknown): string {
  if (error instanceof FeatureNotReadyError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return "Something went wrong."
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/backend${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new Error(
      "The API is not running. From the repo root, install backend/requirements.txt and run npm run api.",
    )
  }

  if (response.status === 501) {
    const body = (await response.json()) as NotReadyBody
    throw new FeatureNotReadyError(
      body.feature ?? "unknown",
      body.module ?? "unknown",
      body.detail ?? "This feature is not implemented yet.",
    )
  }

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

  return response.json() as Promise<T>
}

export function getHealth(): Promise<{ status: string }> {
  return request("/health")
}

export function getAir(place: Place): Promise<AirSnapshot> {
  const params = new URLSearchParams({
    lat: String(place.lat),
    lon: String(place.lon),
  })
  return request(`/api/air?${params.toString()}`)
}

export function geocode(query: string): Promise<GeocodeResponse> {
  const params = new URLSearchParams({ q: query })
  return request(`/geocode?${params.toString()}`)
}

export function getConditions(place: Place): Promise<ConditionsResponse> {
  const params = new URLSearchParams({
    lat: String(place.lat),
    lon: String(place.lon),
  })
  return request(`/conditions?${params.toString()}`)
}

export function planRoutes(
  origin: Place,
  destination: Place,
  profile: HealthProfile,
  poorAir: boolean,
  airLevel?: AirCategory,
  signal?: AbortSignal,
): Promise<RoutesResponse> {
  return request("/api/route", {
    method: "POST",
    signal,
    body: JSON.stringify({
      origin,
      destination,
      profile,
      poor_air: poorAir,
      ...(airLevel ? { air_level: airLevel } : {}),
    }),
  })
}

export function askAssistant(
  message: string,
  profile: HealthProfile,
  origin: Place | null,
  poorAir: boolean,
): Promise<AssistantResponse> {
  return request("/assistant", {
    method: "POST",
    body: JSON.stringify({
      message,
      profile,
      origin,
      poor_air: poorAir,
    }),
  })
}

export const SENSITIVITIES: Sensitivity[] = ["low", "medium", "high"]
