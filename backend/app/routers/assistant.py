from fastapi import APIRouter

from app.schemas import AssistantRequest, AssistantResponse
from app.services.assistant import assist

router = APIRouter(tags=["assistant"])


@router.post("/assistant", response_model=AssistantResponse)
async def assistant(body: AssistantRequest) -> AssistantResponse:
    return await assist(body)
