"""Heat and the timing banner.

Source: Open-Meteo hourly apparent temperature, timezone America/Toronto.
GET /conditions is declared in backend/main.py.
"""

from models import ConditionsResponse, FeatureNotReady, Sensitivity


async def build_conditions(
    lat: float,
    lon: float,
    asthma: Sensitivity,
    copd: Sensitivity,
    heat: Sensitivity,
    poor_air: bool,
) -> ConditionsResponse:
    raise FeatureNotReady("conditions", "backend/weather.py")
