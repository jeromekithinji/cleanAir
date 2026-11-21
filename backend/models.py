"""Shared request and response shapes. The web app expects these fields."""

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class FeatureNotReady(Exception):
    def __init__(self, feature: str, filename: str) -> None:
        self.feature = feature
        self.module = filename
        super().__init__(
            f"{feature} is not implemented yet. Start in {filename}."
        )


class Sensitivity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class TravelMode(str, Enum):
    walk = "walk"
    bike = "bike"


class AirCategory(str, Enum):
    good = "good"
    acceptable = "acceptable"
    poor = "poor"
    unknown = "unknown"


class HealthProfile(BaseModel):
    asthma: Sensitivity
    copd: Sensitivity
    heat: Sensitivity
    mode: TravelMode


class Place(BaseModel):
    label: str
    lat: float
    lon: float


class GeocodeResponse(BaseModel):
    results: list[Place]


class AirReading(BaseModel):
    station_name: str
    neighbourhood: str
    iqa: int | None = None
    category: AirCategory
    pollutant: str | None = None
    observed_at: str | None = None


class ConditionsResponse(BaseModel):
    air: AirReading
    apparent_temperature_c: float | None = None
    banner: str
    suggest_metro: bool
    better_time: str | None = None


class LineString(BaseModel):
    type: Literal["LineString"] = "LineString"
    coordinates: list[list[float]]


class RouteOption(BaseModel):
    id: Literal["fast", "clean"]
    label: str
    duration_seconds: int
    distance_meters: float
    busy_time_seconds: int
    busy_share: float = Field(ge=0, le=1)
    trip_co2_g: float
    driving_co2_g: float
    geometry: LineString
    explanations: list[str]


class RoutesResponse(BaseModel):
    tradeoff: str
    suggest_metro: bool
    routes: list[RouteOption]


class AirResponse(BaseModel):
    station_id: int | None = None
    station_name: str
    neighbourhood: str
    lat: float
    lon: float
    iqa: int | None = None
    level: AirCategory
    observed_at: str | None = None


class RoutesRequest(BaseModel):
    origin: Place
    destination: Place
    profile: HealthProfile
    # Filled from /api/air. "poor" selects clean-strict.json.
    air_level: AirCategory | None = None
    # Checkbox override so routing can be tested before air data is loaded.
    poor_air: bool = False


class AssistantRequest(BaseModel):
    message: str = Field(min_length=1)
    profile: HealthProfile
    origin: Place | None = None
    poor_air: bool = False


class AssistantResponse(BaseModel):
    reply: str
    profile: HealthProfile
    origin: Place | None = None
    destination: Place | None = None
    routes: RoutesResponse | None = None
