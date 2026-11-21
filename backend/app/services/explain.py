"""Plain-language reasons the clean route left a street.

Build these from streets that are busy on the fast route and missing on
the clean one.

- truck_route: "We avoided {street} because it is a heavy truck route."
- primary, trunk, or motorway: "We avoided {street} because it is a busy
  main road."
- If the fast route has no busy streets, say it is already quiet.
"""

from app.errors import FeatureNotReady


def explain_avoided(streets: list[dict[str, str]]) -> list[str]:
    raise FeatureNotReady("explain", "app.services.explain")
