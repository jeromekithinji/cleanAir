from fastapi import APIRouter

from app.schemas import RoutesRequest, RoutesResponse
from app.services.routing import plan_routes

router = APIRouter(tags=["routes"])


@router.post("/routes", response_model=RoutesResponse)
async def routes(body: RoutesRequest) -> RoutesResponse:
    return await plan_routes(body)
