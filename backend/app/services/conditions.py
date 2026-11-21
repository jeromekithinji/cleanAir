"""Banner copy from the nearest station plus heat timing.

Calls air.nearest_station and weather.heat_advice.
poor_air forces the poor category so bad-air routing can be tested
when the live index is good.
"""

from app.errors import FeatureNotReady
from app.schemas import ConditionsResponse, Sensitivity


async def build_conditions(
    lat: float,
    lon: float,
    asthma: Sensitivity,
    copd: Sensitivity,
    heat: Sensitivity,
    poor_air: bool,
) -> ConditionsResponse:
    raise FeatureNotReady("conditions", "app.services.conditions")
