"""Weather from Open-Meteo: every standard surface variable, hourly and daily.

Forecasts are stored in Settings.air_database (backend/data/air.sqlite),
next to the air readings, one forecast per RSQA station. The station list
(names and coordinates) is the one air.py saves.
GET /conditions is declared in backend/main.py.

The bottom of this file is the hourly download, like air.py. It is not a
web request. Run it from the backend folder, then run it again every hour:

    python weather.py

Tables (one column per variable in HOURLY_VARIABLES / DAILY_VARIABLES):
- weather_hourly(station_id, time, temperature_2m, apparent_temperature, ...)
  time is local Montréal time with its offset, e.g. 2026-11-21T16:00:00-05:00
- weather_daily(station_id, date, temperature_2m_max, sunrise, ...)
- weather_units(section, variable, unit)   e.g. ("hourly", "rain", "mm")

Each download also writes the same data to backend/data/weather.json
(every station, hour and day, with units), for reading without sqlite.

If the tables have nothing for the current hour, or the user is far from
every station, /conditions asks Open-Meteo directly instead.

Variable list: https://open-meteo.com/en/docs
"""

import json
import math
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

import air
from air import MAX_STATION_KM, distance_km
from models import ConditionsResponse
from settings import get_settings

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
# The official time zone name for Eastern Time, which Montréal uses.
TIMEZONE = "America/Toronto"
FORECAST_DAYS = 2

HOURLY_VARIABLES = [
    "temperature_2m",
    "relative_humidity_2m",
    "dew_point_2m",
    "apparent_temperature",
    "precipitation_probability",
    "precipitation",
    "rain",
    "showers",
    "snowfall",
    "snow_depth",
    "weather_code",
    "pressure_msl",
    "surface_pressure",
    "cloud_cover",
    "cloud_cover_low",
    "cloud_cover_mid",
    "cloud_cover_high",
    "visibility",
    "evapotranspiration",
    "et0_fao_evapotranspiration",
    "vapour_pressure_deficit",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
    "uv_index",
    "uv_index_clear_sky",
    "is_day",
    "sunshine_duration",
    "cape",
    "freezing_level_height",
    "shortwave_radiation",
]

DAILY_VARIABLES = [
    "weather_code",
    "temperature_2m_max",
    "temperature_2m_min",
    "apparent_temperature_max",
    "apparent_temperature_min",
    "sunrise",
    "sunset",
    "daylight_duration",
    "sunshine_duration",
    "uv_index_max",
    "uv_index_clear_sky_max",
    "precipitation_sum",
    "rain_sum",
    "showers_sum",
    "snowfall_sum",
    "precipitation_hours",
    "precipitation_probability_max",
    "wind_speed_10m_max",
    "wind_gusts_10m_max",
    "wind_direction_10m_dominant",
    "shortwave_radiation_sum",
    "et0_fao_evapotranspiration",
]

Row = dict[str, float | int | str | None]


class Forecast:
    """One location's forecast: rows keyed by variable name, plus units."""

    def __init__(self, hourly: list[Row], daily: list[Row], units: dict[str, dict[str, str]]):
        self.hourly = hourly
        self.daily = daily
        self.units = units


# --- Reading Open-Meteo -------------------------------------------------


def columns_to_rows(section: dict[str, list]) -> list[Row]:
    """Open-Meteo sends one list per variable; turn that into one dict per time."""
    names = list(section)
    return [dict(zip(names, values)) for values in zip(*section.values())]


def parse_forecast(data: dict) -> Forecast:
    """Turn one Open-Meteo location into a Forecast.

    Hourly times get the UTC offset from Open-Meteo, so no time zone database
    is needed (Windows Python has none without the tzdata package).
    """
    tz = timezone(timedelta(seconds=data["utc_offset_seconds"]))
    hourly = columns_to_rows(data["hourly"])
    for row in hourly:
        row["time"] = datetime.fromisoformat(row["time"]).replace(tzinfo=tz).isoformat()
    daily = columns_to_rows(data["daily"])
    for row in daily:
        row["date"] = row.pop("time")
    units = {
        "hourly": {k: v for k, v in data["hourly_units"].items() if k != "time"},
        "daily": {k: v for k, v in data["daily_units"].items() if k != "time"},
    }
    return Forecast(hourly, daily, units)


def forecast_params(lats: list[float], lons: list[float]) -> dict[str, str | int]:
    """Query for one or several locations. Several return a JSON list."""
    return {
        "latitude": ",".join(str(lat) for lat in lats),
        "longitude": ",".join(str(lon) for lon in lons),
        "hourly": ",".join(HOURLY_VARIABLES),
        "daily": ",".join(DAILY_VARIABLES),
        "timezone": TIMEZONE,
        "forecast_days": FORECAST_DAYS,
    }


async def fetch_live(lat: float, lon: float) -> Forecast:
    """Ask Open-Meteo directly, for when the tables have nothing nearby."""
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(OPEN_METEO_URL, params=forecast_params([lat], [lon]))
        response.raise_for_status()
    return parse_forecast(response.json())


# --- The sqlite tables --------------------------------------------------

# No column types on purpose: sqlite then keeps each value exactly as given
# (whole numbers stay whole, sunrise/sunset stay text).
HOURLY_TABLE = f"""
    CREATE TABLE IF NOT EXISTS weather_hourly (
        station_id INTEGER NOT NULL REFERENCES stations(station_id),
        time       TEXT NOT NULL,
        {", ".join(HOURLY_VARIABLES)},
        PRIMARY KEY (station_id, time)
    )
"""
DAILY_TABLE = f"""
    CREATE TABLE IF NOT EXISTS weather_daily (
        station_id INTEGER NOT NULL REFERENCES stations(station_id),
        date       TEXT NOT NULL,
        {", ".join(DAILY_VARIABLES)},
        PRIMARY KEY (station_id, date)
    )
"""
UNITS_TABLE = """
    CREATE TABLE IF NOT EXISTS weather_units (
        section  TEXT NOT NULL,
        variable TEXT NOT NULL,
        unit     TEXT NOT NULL,
        PRIMARY KEY (section, variable)
    )
"""


def create_tables(db: sqlite3.Connection) -> None:
    db.execute(HOURLY_TABLE)
    db.execute(DAILY_TABLE)
    db.execute(UNITS_TABLE)


def connect(database: Path) -> sqlite3.Connection:
    """Open air.sqlite (with the air tables) and add the weather tables."""
    db = air.connect(database)
    create_tables(db)
    return db


def insert_rows(db: sqlite3.Connection, table: str, station_id: int, rows: list[Row]) -> None:
    for row in rows:
        names = ["station_id", *row]
        db.execute(
            f"INSERT INTO {table} ({', '.join(names)}) "
            f"VALUES ({', '.join('?' for _ in names)})",
            [station_id, *row.values()],
        )


def save_forecasts(db: sqlite3.Connection) -> tuple[int, int, int]:
    """Replace every station's forecast. Returns (stations, hours, days)."""
    query = "SELECT station_id, latitude, longitude FROM stations ORDER BY station_id"
    stations = db.execute(query).fetchall()
    if not stations:
        # air.py has not run yet: load the station list first.
        air.save_stations(db)
        stations = db.execute(query).fetchall()

    response = httpx.get(
        OPEN_METEO_URL,
        params=forecast_params([s[1] for s in stations], [s[2] for s in stations]),
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    locations = data if isinstance(data, list) else [data]

    # Recreate the tables so a change to the variable lists takes effect.
    # "weather" is the older single-variable table.
    for table in ("weather", "weather_hourly", "weather_daily", "weather_units"):
        db.execute(f"DROP TABLE IF EXISTS {table}")
    create_tables(db)

    hours = days = 0
    units: dict[str, dict[str, str]] = {}
    for (station_id, _lat, _lon), location in zip(stations, locations):
        forecast = parse_forecast(location)
        insert_rows(db, "weather_hourly", station_id, forecast.hourly)
        insert_rows(db, "weather_daily", station_id, forecast.daily)
        hours += len(forecast.hourly)
        days += len(forecast.daily)
        units = forecast.units

    for section, variables in units.items():
        for variable, unit in variables.items():
            db.execute("INSERT INTO weather_units VALUES (?, ?, ?)", (section, variable, unit))
    return len(stations), hours, days


def stored_forecast(lat: float, lon: float) -> tuple[str | None, Forecast | None]:
    """The nearest station with a forecast: (its name, its forecast).

    Returns (None, None) when nothing is stored within MAX_STATION_KM.
    """
    database = get_settings().air_database
    if not database.is_file():
        return None, None
    with connect(database) as db:
        db.row_factory = sqlite3.Row
        stations = db.execute(
            """
            SELECT station_id, name, latitude, longitude FROM stations
            WHERE station_id IN (SELECT DISTINCT station_id FROM weather_hourly)
            """
        ).fetchall()

        best = None
        best_km = math.inf
        for station in stations:
            km = distance_km(lat, lon, station["latitude"], station["longitude"])
            if km < best_km:
                best, best_km = station, km
        if best is None or best_km > MAX_STATION_KM:
            return None, None

        def rows(table: str, order: str) -> list[Row]:
            found = db.execute(
                f"SELECT * FROM {table} WHERE station_id = ? ORDER BY {order}",
                (best["station_id"],),
            ).fetchall()
            return [{k: r[k] for k in r.keys() if k != "station_id"} for r in found]

        units: dict[str, dict[str, str]] = {"hourly": {}, "daily": {}}
        for section, variable, unit in db.execute("SELECT * FROM weather_units"):
            units.setdefault(section, {})[variable] = unit

        forecast = Forecast(rows("weather_hourly", "time"), rows("weather_daily", "date"), units)
    return best["name"], forecast


def from_this_hour(hourly: list[Row], now: datetime) -> list[Row]:
    """The current hour and every hour after it."""
    this_hour = now.replace(minute=0, second=0, microsecond=0)
    return [row for row in hourly if datetime.fromisoformat(str(row["time"])) >= this_hour]


def has_this_hour(hourly: list[Row], now: datetime) -> bool:
    this_hour = now.replace(minute=0, second=0, microsecond=0)
    return bool(hourly) and datetime.fromisoformat(str(hourly[0]["time"])) == this_hour


# --- GET /conditions -----------------------------------------------------


async def build_conditions(lat: float, lon: float) -> ConditionsResponse:
    """Weather near (lat, lon): this hour, the hours after it, and each day."""
    now = datetime.now(timezone.utc)

    source = "stored"
    station_name, forecast = stored_forecast(lat, lon)
    hourly = from_this_hour(forecast.hourly, now) if forecast else []
    if not has_this_hour(hourly, now):
        # Nothing stored for this hour: ask Open-Meteo directly.
        source = "live"
        station_name = None
        try:
            forecast = await fetch_live(lat, lon)
            hourly = from_this_hour(forecast.hourly, now)
        except (httpx.HTTPError, KeyError, ValueError):
            forecast, hourly = None, []

    if forecast is None:
        return ConditionsResponse(source="unavailable")
    return ConditionsResponse(
        source=source,
        station_name=station_name,
        current=hourly[0] if has_this_hour(hourly, now) else None,
        hourly=hourly,
        daily=forecast.daily,
        units=forecast.units,
    )


# --- Hourly download ------------------------------------------------------


def export_json(db: sqlite3.Connection, path: Path) -> None:
    """Write every station's stored forecast to one JSON file.

    Same data as the sqlite tables, for reading without sqlite
    (e.g. the AI feature). Shape:
    {"downloaded_at", "units": {"hourly", "daily"},
     "stations": [{"station_id", "name", "neighbourhood", "latitude",
                   "longitude", "hourly": [...], "daily": [...]}]}
    """
    db.row_factory = sqlite3.Row

    def rows(table: str, station_id: int, order: str) -> list[Row]:
        found = db.execute(
            f"SELECT * FROM {table} WHERE station_id = ? ORDER BY {order}",
            (station_id,),
        ).fetchall()
        return [{k: r[k] for k in r.keys() if k != "station_id"} for r in found]

    units: dict[str, dict[str, str]] = {"hourly": {}, "daily": {}}
    for row in db.execute("SELECT * FROM weather_units"):
        units.setdefault(row["section"], {})[row["variable"]] = row["unit"]

    stations = []
    for s in db.execute(
        "SELECT * FROM stations WHERE station_id IN "
        "(SELECT DISTINCT station_id FROM weather_hourly) ORDER BY station_id"
    ).fetchall():
        stations.append(
            {
                "station_id": s["station_id"],
                "name": s["name"],
                "neighbourhood": s["neighbourhood"],
                "latitude": s["latitude"],
                "longitude": s["longitude"],
                "hourly": rows("weather_hourly", s["station_id"], "time"),
                "daily": rows("weather_daily", s["station_id"], "date"),
            }
        )
    db.row_factory = None

    path.write_text(
        json.dumps(
            {
                "downloaded_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "units": units,
                "stations": stations,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def download_latest() -> None:
    database = get_settings().air_database
    json_path = database.with_name("weather.json")
    with connect(database) as db:
        stations, hours, days = save_forecasts(db)
        db.commit()
        export_json(db, json_path)
    print(
        f"Saved {hours} hours and {days} days of forecasts "
        f"for {stations} stations to {database}\n"
        f"Wrote the same data to {json_path}"
    )


if __name__ == "__main__":
    download_latest()
