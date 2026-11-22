"""Task A. Fastest route and a clean-air route.

GraphHopper runs at Settings.graphhopper_url (default http://127.0.0.1:8989).
Setup steps are in the README under "Task A — routing".

Your files:
- backend/routing.py                  (this file)
- backend/graphhopper/config.yml
- backend/graphhopper/clean.json
- backend/graphhopper/clean-strict.json
- POST /api/route is declared in backend/main.py

Inside plan_routes:
1. Use profile "bike" or "foot" from request.profile.mode.
2. Call GraphHopper /route twice, both with "details": ["road_class"].
   The first call is the normal profile (fastest), with no rules file.
   The second call adds the rules in CLEAN_MODEL.
3. Ask air.nearest_station for the origin. If the level is "poor", or
   request.poor_air is true, use CLEAN_STRICT_MODEL instead.
4. Busy share = distance on MOTORWAY, TRUNK, PRIMARY, and SECONDARY / total distance.
5. Tradeoff text, for example "+4 min, 60% less on busy roads".
6. CO2 numbers come from co2.py.
"""
import json
import math
from pathlib import Path

import httpx

import co2
from air import nearest_station
from models import (
    AirCategory,
    LineString,
    Place,
    RouteOption,
    RoutesRequest,
    RoutesResponse,
    TravelMode,
)
from settings import CLEAN_MODEL, CLEAN_STRICT_MODEL, get_settings


# The app says "walk", GraphHopper calls the same thing "foot".
GRAPHHOPPER_PROFILE = {TravelMode.bike: "bike", TravelMode.walk: "foot"}


class RoutingUnavailable(Exception):
    """GraphHopper did not return a route. The request should fail."""

    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


async def fetch_route(
    origin: Place, destination: Place, profile: str, model_file: Path | None = None
) -> dict:
    """Ask GraphHopper for one route and return its first path."""
    body = {
        "points": [[origin.lon, origin.lat], [destination.lon, destination.lat]],
        "profile": profile,
        "details": ["road_class"],
        "points_encoded": False,
        "ch.disable": True,
    }
    if model_file is not None:
        body["custom_model"] = json.loads(model_file.read_text())

    url = f"{get_settings().graphhopper_url}/route"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, json=body)
    except httpx.HTTPError as exc:
        raise RoutingUnavailable(
            "GraphHopper is not running. Start it on port 8989."
        ) from exc
    if response.status_code >= 400:
        raise RoutingUnavailable(
            f"GraphHopper rejected the route ({response.status_code})."
        )
    paths = response.json().get("paths") or []
    if not paths:
        raise RoutingUnavailable("GraphHopper did not return a route.")
    return paths[0]
# Agreed with the team: these road types count as busy.
BUSY_ROADS = {"motorway", "trunk", "primary", "secondary"}


def segment_meters(a: list[float], b: list[float]) -> float:
    """Approximate distance in metres between two [lon, lat] points."""
    dx = (b[0] - a[0]) * 111_320 * math.cos(math.radians(a[1]))
    dy = (b[1] - a[1]) * 110_540
    return math.hypot(dx, dy)


def busy_share(path: dict) -> float:
    """Fraction of the route (0 to 1) that is on busy roads."""
    coords = path["points"]["coordinates"]
    last = len(coords) - 1
    busy = total = 0.0
    for start, end, road_class in path["details"]["road_class"]:
        meters = 0.0
        for index in range(start, end):
            if index < 0 or index >= last:
                continue
            meters += segment_meters(coords[index], coords[index + 1])
        total += meters
        if str(road_class).lower() in BUSY_ROADS:
            busy += meters
    if total <= 0:
        return 0.0
    return min(1.0, busy / total)


async def air_level_for(request: RoutesRequest) -> AirCategory:
    """The air level at the trip origin. Uses what the page sent if it sent one."""
    if request.poor_air:
        return AirCategory.poor
    if request.air_level is not None:
        return request.air_level
    try:
        station = await nearest_station(request.origin.lat, request.origin.lon)
        return station.level
    except Exception:
        # Air data is a bonus. A broken air database should not stop routing.
        return AirCategory.unknown


def rules_file_for(level: AirCategory) -> Path:
    """Strict rules on poor-air days, normal clean rules otherwise."""
    return CLEAN_STRICT_MODEL if level == AirCategory.poor else CLEAN_MODEL



def route_option(route_id: str, label: str, path: dict) -> RouteOption:
    """Turn one GraphHopper path into the card the page shows."""
    share = busy_share(path)
    seconds = round(path["time"] / 1000)  # GraphHopper gives milliseconds
    return RouteOption(
        id=route_id,
        label=label,
        duration_seconds=seconds,
        distance_meters=round(path["distance"], 1),
        busy_time_seconds=round(seconds * share),
        busy_share=round(share, 3),
        trip_co2_g=co2.trip_co2_g(),
        driving_co2_g=co2.driving_co2_g(path["distance"]),
        geometry=LineString(coordinates=path["points"]["coordinates"]),
        explanations=[],  # Filled in later by explain.py (another task)
    )


def format_minutes(total: int) -> str:
    """45 -> "45 min", 60 -> "1 h", 75 -> "1 h 15 min"."""
    if total < 60:
        return f"{total} min"
    hours, rest = divmod(total, 60)
    return f"{hours} h" if rest == 0 else f"{hours} h {rest} min"


def tradeoff_text(fast: RouteOption, clean: RouteOption, mode: TravelMode) -> str:
    """One line comparing the two routes, e.g. "+3 min, 3 min less in busy areas"."""
    extra = round((clean.duration_seconds - fast.duration_seconds) / 60)
    if extra > 0:
        time_part = f"+{format_minutes(extra)}"
    elif extra < 0:
        time_part = f"-{format_minutes(-extra)}"  # the clean route is faster: "-2 min"
    else:
        time_part = "Same time"

    if mode == TravelMode.walk:
        # Sidewalks are mapped as "footway", so busy streets can't be measured
        # for walking. Don't show a misleading 0%.
        return f"{time_part}, quieter streets"
    # Same minutes as the route cards show ("5 min in busy areas").
    fast_busy = round(fast.busy_time_seconds / 60)
    clean_busy = round(clean.busy_time_seconds / 60)
    saved = fast_busy - clean_busy
    if fast.busy_share == 0:
        busy_part = "both routes avoid busy areas"
    elif saved >= 1:
        busy_part = f"{format_minutes(saved)} less in busy areas"
    else:
        busy_part = "about the same time in busy areas"

    return f"{time_part}, {busy_part}"


async def plan_routes(request: RoutesRequest) -> RoutesResponse:
    profile = GRAPHHOPPER_PROFILE[request.profile.mode]
    level = await air_level_for(request)

    fast_path = await fetch_route(request.origin, request.destination, profile)
    clean_path = await fetch_route(
        request.origin, request.destination, profile, rules_file_for(level)
    )

    fast = route_option("fast", "Fastest", fast_path)
    clean = route_option("clean", "Cleaner air", clean_path)

    return RoutesResponse(
        tradeoff=tradeoff_text(fast, clean,request.profile.mode),
        suggest_metro=level == AirCategory.poor,
        routes=[fast, clean],
    )


