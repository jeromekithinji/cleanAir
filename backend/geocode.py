"""Address search biased to Montréal.

Data source: Photon (https://photon.komoot.io), limited to the island.
GET /geocode is declared in backend/main.py.
"""

from models import FeatureNotReady, GeocodeResponse


async def search_places(query: str) -> GeocodeResponse:
    raise FeatureNotReady("geocode", "backend/geocode.py")
