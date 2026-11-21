"""Task A. Fastest route and a clean-air route.

GraphHopper runs at Settings.graphhopper_url (default http://127.0.0.1:8989).
Setup steps are in the README under "Task A — routing".

Your files:
- backend/routing.py                  (this file)
- backend/graphhopper/config.yml
- backend/graphhopper/clean.json
- backend/graphhopper/clean-strict.json
- POST /api/route is declared in backend/main.py

Inside plan_routes:
1. Use profile "bike" or "foot" from request.profile.mode.
2. Call GraphHopper /route twice, both with "details": ["road_class"].
   The first call is the normal profile (fastest), with no rules file.
   The second call adds the rules in CLEAN_MODEL.
3. Ask air.nearest_station for the origin. If the level is "poor", or
   request.poor_air is true, use CLEAN_STRICT_MODEL instead.
4. Busy share = distance on MOTORWAY, TRUNK, and PRIMARY / total distance.
5. Tradeoff text, for example "+4 min, 60% less on busy roads".
6. CO2 numbers come from co2.py.
"""

from models import FeatureNotReady, RoutesRequest, RoutesResponse


async def plan_routes(request: RoutesRequest) -> RoutesResponse:
    raise FeatureNotReady("routes", "backend/routing.py")
