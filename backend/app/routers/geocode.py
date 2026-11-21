from fastapi import APIRouter, Query

from app.schemas import GeocodeResponse
from app.services.geocode import search_places

router = APIRouter(tags=["geocode"])


@router.get("/geocode", response_model=GeocodeResponse)
async def geocode(q: str = Query(min_length=1)) -> GeocodeResponse:
    return await search_places(q)
