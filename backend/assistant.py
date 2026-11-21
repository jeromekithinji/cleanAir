"""Turn one sentence into a route request.

The model only extracts destination, mode, and named sensitivities.
routing.plan_routes builds the paths. If the sentence has no start,
use the origin the browser sent.

POST /assistant is declared in backend/main.py.
Uses AI_GATEWAY_API_KEY and AI_MODEL from settings.py.
If the key is empty, say so and do not invent a route.
"""

from models import AssistantRequest, AssistantResponse, FeatureNotReady


async def assist(request: AssistantRequest) -> AssistantResponse:
    raise FeatureNotReady("assistant", "backend/assistant.py")
