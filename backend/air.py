"""Task B. Montréal air quality.

Levels: 1–25 good, 26–50 acceptable, 51 or more poor.
Readings are stored in Settings.air_database (backend/data/air.sqlite).

Your files:
- backend/air.py                         (this file)
- GET /api/air is declared in backend/main.py
- src/lib/api.ts getAir
- src/components/conditions-banner.tsx

nearest_station is also what routing.py calls. A "poor" level makes
routing use backend/graphhopper/clean-strict.json.

The bottom of this file is the hourly download. It is not a web request.
Run it from the backend folder, then run it again every hour:

    python air.py

Sources:
- Station list: https://donnees.montreal.ca/dataset/rsqa-liste-des-stations
- Hourly IQA: https://donnees.montreal.ca/dataset/rsqa-indice-qualite-air
  Use the file named "IQA par station en temps réel".

Suggested tables:
- stations(station_id, name, neighbourhood, latitude, longitude)
- readings(station_id, iqa, pollutant, observed_at)

Load the station list once. Each hourly run replaces the latest reading
per station. Do not commit the sqlite file or the CSVs.
"""

import csv
import io
import math
import sqlite3
from pathlib import Path

import httpx

from models import AirCategory, AirResponse
from settings import get_settings

# Farther than this from every station, the reading would not describe the
# user's air, so the level is "unknown" (e.g. a trip outside Montréal).
MAX_STATION_KM = 20

STATIONS_URL = (
    "https://donnees.montreal.ca/dataset/ae01f7f3-4d69-404a-9be1-74abfdc96571"
    "/resource/29db5545-89a4-4e4a-9e95-05aa6dc2fd80"
    "/download/liste-des-stations_do_rev_2026-05-22.csv"
)

HOURLY_URL = (
    "https://donnees.montreal.ca/dataset/3e9f7b96-3f25-4404-a5ad-22d9a31060e6"
    "/resource/6554355e-63d1-4a01-a268-91e0763c3606"
    "/download/iqa-by-station.csv"
)

# RSQA times are always Eastern Standard Time (UTC-5), even in summer.
RSQA_OFFSET = "-05:00"

# The portal answers "RBAC: access denied" without a browser-like User-Agent.
HEADERS = {"User-Agent": "Mozilla/5.0 (CleanAir hackathon app)"}


def fetch_csv(url: str) -> list[dict[str, str]]:
    """Download a CSV and return its rows as dictionaries."""
    response = httpx.get(url, headers=HEADERS, timeout=30, follow_redirects=True)
    response.raise_for_status()
    text = response.content.decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text)))


def save_stations(db: sqlite3.Connection) -> int:
    """Save every open RSQA station. Returns how many were saved."""
    saved = 0
    for row in fetch_csv(STATIONS_URL):
        if row["statut"].strip().lower() != "ouvert":
            continue
        db.execute(
            "INSERT OR REPLACE INTO stations VALUES (?, ?, ?, ?, ?)",
            (
                int(row["numero_station"]),
                row["nom"].strip(),
                row["arrondissement_ville"].strip(),
                float(row["latitude"]),
                float(row["longitude"]),
            ),
        )
        saved += 1
    return saved


def save_readings(db: sqlite3.Connection) -> int:
    """Keep the latest hour per station and replace the old readings."""
    known = {row[0] for row in db.execute("SELECT station_id FROM stations")}

    latest: dict[int, dict[str, str]] = {}
    for row in fetch_csv(HOURLY_URL):
        if not row["valeur"].strip():
            continue
        station_id = int(row["stationId"])
        if station_id not in known:
            continue
        current = latest.get(station_id)
        if current is None or int(row["heure"]) > int(current["heure"]):
            latest[station_id] = row

    db.execute("DELETE FROM readings")
    for station_id, row in latest.items():
        observed_at = f"{row['date']}T{int(row['heure']):02d}:00:00{RSQA_OFFSET}"
        db.execute(
            "INSERT INTO readings VALUES (?, ?, ?, ?)",
            (station_id, int(row["valeur"]), row["pollutant"].strip(), observed_at),
        )
    return len(latest)


def connect(database: Path) -> sqlite3.Connection:
    """Open the sqlite file, creating the folder and tables if needed."""
    database.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(database)
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS stations (
            station_id    INTEGER PRIMARY KEY,
            name          TEXT NOT NULL,
            neighbourhood TEXT NOT NULL,
            latitude      REAL NOT NULL,
            longitude     REAL NOT NULL
        )
        """
    )
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS readings (
            station_id  INTEGER PRIMARY KEY REFERENCES stations(station_id),
            iqa         INTEGER NOT NULL,
            pollutant   TEXT,
            observed_at TEXT NOT NULL
        )
        """
    )
    return db


def level_for(iqa: int) -> AirCategory:
    """1–25 good, 26–50 acceptable, 51 or more poor."""
    if iqa <= 25:
        return AirCategory.good
    if iqa <= 50:
        return AirCategory.acceptable
    return AirCategory.poor


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Straight-line distance between two points on Earth (haversine)."""
    earth_radius_km = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return 2 * earth_radius_km * math.asin(math.sqrt(a))


async def nearest_station(lat: float, lon: float) -> AirResponse:
    """The closest station with a current reading, and its level."""
    with connect(get_settings().air_database) as db:
        rows = db.execute(
            """
            SELECT s.station_id, s.name, s.neighbourhood, s.latitude, s.longitude,
                   r.iqa, r.observed_at
            FROM stations s
            JOIN readings r ON r.station_id = s.station_id
            """
        ).fetchall()

    best = None
    best_km = math.inf
    for row in rows:
        km = distance_km(lat, lon, row[3], row[4])
        if km < best_km:
            best, best_km = row, km

    if best is None or best_km > MAX_STATION_KM:
        return AirResponse(
            station_name="No station nearby",
            neighbourhood="",
            lat=lat,
            lon=lon,
            level=AirCategory.unknown,
        )

    station_id, name, neighbourhood, station_lat, station_lon, iqa, observed_at = best
    return AirResponse(
        station_id=station_id,
        station_name=name,
        neighbourhood=neighbourhood,
        lat=station_lat,
        lon=station_lon,
        iqa=iqa,
        level=level_for(iqa),
        observed_at=observed_at,
    )


def download_latest() -> None:
    database = get_settings().air_database
    with connect(database) as db:
        stations = save_stations(db)
        readings = save_readings(db)
    print(f"Saved {stations} open stations and {readings} readings to {database}")


if __name__ == "__main__":
    download_latest()
