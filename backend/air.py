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

from models import AirResponse, FeatureNotReady
from settings import get_settings


async def nearest_station(lat: float, lon: float) -> AirResponse:
    raise FeatureNotReady("air", "backend/air.py")


def download_latest() -> None:
    database = get_settings().air_database
    raise SystemExit(
        "The hourly air download is not written yet. "
        f"Add it in download_latest() in backend/air.py. Database: {database}"
    )


if __name__ == "__main__":
    download_latest()
