from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.errors import FeatureNotReady
from app.routers import assistant, conditions, geocode, routes

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

app.include_router(geocode.router)
app.include_router(conditions.router)
app.include_router(routes.router)
app.include_router(assistant.router)


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
            {
                "name": "geocode",
                "method": "GET",
                "path": "/geocode",
                "module": "app.services.geocode",
            },
            {
                "name": "conditions",
                "method": "GET",
                "path": "/conditions",
                "module": "app.services.conditions",
            },
            {
                "name": "routes",
                "method": "POST",
                "path": "/routes",
                "module": "app.services.routing",
            },
            {
                "name": "assistant",
                "method": "POST",
                "path": "/assistant",
                "module": "app.services.assistant",
            },
        ],
    }
