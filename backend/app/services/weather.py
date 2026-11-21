"""Heat and timing advice.

Source: Open-Meteo hourly apparent temperature and hourly air quality,
timezone America/Toronto. RSQA has no forecast, so the hourly air series
is only for comparing earlier and later today.
"""

from app.errors import FeatureNotReady
from app.schemas import Sensitivity


async def heat_advice(
    lat: float,
    lon: float,
    heat: Sensitivity,
    air_is_poor: bool,
) -> dict[str, object]:
    raise FeatureNotReady("weather", "app.services.weather")
