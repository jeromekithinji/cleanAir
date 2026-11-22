export type Sensitivity = "low" | "medium" | "high"

export type TravelMode = "walk" | "bike"

export type AirCategory = "good" | "acceptable" | "poor" | "unknown"

export interface HealthProfile {
  asthma: Sensitivity
  copd: Sensitivity
  heat: Sensitivity
  mode: TravelMode
}

export interface Place {
  label: string
  lat: number
  lon: number
}

export interface GeocodeResponse {
  results: Place[]
}

export interface AirSnapshot {
  station_id: number | null
  station_name: string
  neighbourhood: string
  lat: number
  lon: number
  iqa: number | null
  level: AirCategory
  pollutant: string | null
  observed_at: string | null
}

export interface AirReading {
  station_name: string
  neighbourhood: string
  iqa: number | null
  category: AirCategory
  pollutant: string | null
  observed_at: string | null
}

// One time step from Open-Meteo: { time: "...", temperature_2m: 7, ... }.
// The variable names are the lists in backend/weather.py.
export type WeatherRow = Record<string, number | string | null>

export interface ConditionsResponse {
  source: "stored" | "live" | "unavailable"
  station_name: string | null
  current: WeatherRow | null
  hourly: WeatherRow[]
  daily: WeatherRow[]
  units: { hourly?: Record<string, string>; daily?: Record<string, string> }
}

export interface LineString {
  type: "LineString"
  coordinates: number[][]
}

export interface RouteOption {
  id: "fast" | "clean"
  label: string
  duration_seconds: number
  distance_meters: number
  busy_time_seconds: number
  busy_share: number
  trip_co2_g: number
  driving_co2_g: number
  geometry: LineString
  explanations: string[]
}

export interface RoutesResponse {
  tradeoff: string
  suggest_metro: boolean
  routes: RouteOption[]
}

export interface AssistantResponse {
  reply: string
  profile: HealthProfile
  origin: Place | null
  destination: Place | null
  routes: RoutesResponse | null
}
