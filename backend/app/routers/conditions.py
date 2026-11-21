from fastapi import APIRouter, Query

from app.schemas import ConditionsResponse, Sensitivity
from app.services.conditions import build_conditions

router = APIRouter(tags=["conditions"])


@router.get("/conditions", response_model=ConditionsResponse)
async def conditions(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    asthma: Sensitivity = Sensitivity.medium,
    copd: Sensitivity = Sensitivity.low,
    heat: Sensitivity = Sensitivity.medium,
    poor_air: bool = False,
) -> ConditionsResponse:
    return await build_conditions(lat, lon, asthma, copd, heat, poor_air)
