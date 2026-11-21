"""Address search biased to Montréal.

Data source: Photon (https://photon.komoot.io), limited to the island.
"""

from app.errors import FeatureNotReady
from app.schemas import GeocodeResponse


async def search_places(query: str) -> GeocodeResponse:
    raise FeatureNotReady("geocode", "app.services.geocode")
