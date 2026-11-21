"""Fastest route and a quieter clean-air route.

Valhalla base URL comes from Settings.valhalla_url.

- Fast bike: bicycle costing with use_roads near 1.
- Fast walk: default pedestrian costing.
- Busy time: motorway, trunk, primary, and truck_route edges.
  High asthma or COPD, or poor air, also counts secondary.
- Clean bike: lower use_roads (about 0.55 / 0.25 / 0.05).
- Clean walk: exclude_polygons around the fast route's busy edges.
- Poor air drops avoidance one more step.
- Tradeoff line uses duration, for example
  "+4 min, about 60% less time on busy roads."

Use co2.driving_co2_g for driving_co2_g and explain.explain_avoided
for explanations. Do not call the language model from here.
"""

from app.errors import FeatureNotReady
from app.schemas import RoutesRequest, RoutesResponse


async def plan_routes(request: RoutesRequest) -> RoutesResponse:
    raise FeatureNotReady("routes", "app.services.routing")
