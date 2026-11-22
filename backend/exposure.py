"""Exposure score: how much traffic pollution, poor air and heat a route exposes you to.

0 is the least exposure and 100 the most. Three parts, each from 0 to 1:

- Traffic (weight 0.5): the share of the route on busy roads (motorway, trunk,
  primary, secondary), the same busy_share routing.py measures. These are the
  roads the exposure map draws in red.
- Air (weight 0.3): the IQA of the station nearest the trip start, from air.py.
  0 at IQA 0, 1 at IQA 75 or more (51+ is already "poor").
- Heat (weight 0.2): the feels-like temperature now, from weather.py.
  0 at 20 °C or less, 1 at 35 °C or more.

A part with no data (no air reading, no weather) is left out and the
others share its weight, so the score is still on the same 0-100 scale.

Levels: 0-33 low, 34-66 medium, 67-100 high.
"""

from datetime import datetime, timezone

import weather
from air import nearest_station

WEIGHTS = {"traffic": 0.5, "air": 0.3, "heat": 0.2}

# Air part: IQA at which it counts fully.
IQA_FULL = 75
# Heat part: feels-like range in °C from no effect to full.
HEAT_START_C = 20
HEAT_FULL_C = 35


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


async def air_part(lat: float, lon: float) -> float | None:
    """0 to 1 from the nearest station's IQA, or None without a reading."""
    try:
        station = await nearest_station(lat, lon)
    except Exception:
        return None
    if station.iqa is None:
        return None
    return clamp01(station.iqa / IQA_FULL)


def heat_part(lat: float, lon: float) -> float | None:
    """0 to 1 from this hour's stored feels-like temperature, or None."""
    try:
        _station, forecast = weather.stored_forecast(lat, lon)
    except Exception:
        return None
    if forecast is None:
        return None
    hours = weather.from_this_hour(forecast.hourly, datetime.now(timezone.utc))
    if not hours:
        return None
    feels = hours[0].get("apparent_temperature")
    if not isinstance(feels, (int, float)):
        return None
    return clamp01((feels - HEAT_START_C) / (HEAT_FULL_C - HEAT_START_C))


async def conditions_at(lat: float, lon: float) -> dict[str, float | None]:
    """The air and heat parts at the trip start. Both routes share them."""
    return {"air": await air_part(lat, lon), "heat": heat_part(lat, lon)}


def score(traffic: float, conditions: dict[str, float | None]) -> int:
    """Combine the parts into 0-100, leaving out parts with no data."""
    parts = {"traffic": clamp01(traffic), **conditions}
    known = {name: value for name, value in parts.items() if value is not None}
    total_weight = sum(WEIGHTS[name] for name in known)
    if total_weight == 0:
        return 0
    weighted = sum(WEIGHTS[name] * value for name, value in known.items())
    return round(100 * weighted / total_weight)


def level(value: int) -> str:
    if value <= 33:
        return "low"
    if value <= 66:
        return "medium"
    return "high"
