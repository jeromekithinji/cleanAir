"""HTTP entry points. Each function below calls one file in this folder."""

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from air import nearest_station
from assistant import assist
from geocode import search_places
from models import (
    AirResponse,
    AssistantRequest,
    AssistantResponse,
    ConditionsResponse,
    FeatureNotReady,
    GeocodeResponse,
    RoutesRequest,
    RoutesResponse,
)
from routing import plan_routes
from settings import get_settings
from weather import build_conditions

settings = get_settings()

app = FastAPI(
    title="Clean Air API",
    version="0.1.0",
    description="Walking and biking routes that avoid busy Montréal roads.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(FeatureNotReady)
async def feature_not_ready(_request: object, exc: FeatureNotReady) -> JSONResponse:
    return JSONResponse(
        status_code=501,
        content={
            "feature": exc.feature,
            "module": exc.module,
            "detail": str(exc),
        },
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def root() -> dict[str, object]:
    return {
        "name": "Clean Air API",
        "docs": "/docs",
        "health": "/health",
        "features": [
            {"name": "air", "method": "GET", "path": "/api/air", "file": "air.py"},
            {
                "name": "route",
                "method": "POST",
                "path": "/api/route",
                "file": "routing.py",
            },
            {
                "name": "geocode",
                "method": "GET",
                "path": "/geocode",
                "file": "geocode.py",
            },
            {
                "name": "conditions",
                "method": "GET",
                "path": "/conditions",
                "file": "weather.py",
            },
            {
                "name": "assistant",
                "method": "POST",
                "path": "/assistant",
                "file": "assistant.py",
            },
        ],
    }


@app.get("/api/air", response_model=AirResponse)
async def air(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
) -> AirResponse:
    return await nearest_station(lat, lon)


@app.post("/api/route", response_model=RoutesResponse)
async def route(body: RoutesRequest) -> RoutesResponse:
    return await plan_routes(body)


@app.get("/geocode", response_model=GeocodeResponse)
async def geocode(q: str = Query(min_length=1)) -> GeocodeResponse:
    return await search_places(q)


@app.get("/conditions", response_model=ConditionsResponse)
async def conditions(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
) -> ConditionsResponse:
    return await build_conditions(lat, lon)


@app.post("/assistant", response_model=AssistantResponse)
async def assistant(body: AssistantRequest) -> AssistantResponse:
    return await assist(body)
