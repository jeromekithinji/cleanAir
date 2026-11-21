"""Nearest Montréal RSQA station and the current IQA.

Scale: 1–25 good, 26–50 acceptable, 51 or more poor.
Sources: CKAN packages rsqa-indice-qualite-air and rsqa-liste-des-stations.
"""

from app.errors import FeatureNotReady
from app.schemas import AirReading


async def nearest_station(lat: float, lon: float) -> AirReading:
    raise FeatureNotReady("air", "app.services.air")
