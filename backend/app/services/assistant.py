"""Turn one sentence into a route request.

The model only extracts destination, mode, and named sensitivities.
plan_routes builds the paths. A missing origin uses the Place the client
sent from browser geolocation.

Gateway: POST {AI_GATEWAY base}/v1/chat/completions
with AI_GATEWAY_API_KEY and AI_MODEL (provider/model).
If the key is empty, return a clear message and do not invent a route.
"""

from app.errors import FeatureNotReady
from app.schemas import AssistantRequest, AssistantResponse


async def assist(request: AssistantRequest) -> AssistantResponse:
    raise FeatureNotReady("assistant", "app.services.assistant")
