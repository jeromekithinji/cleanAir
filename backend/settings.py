"""Paths and environment variables."""

import os
from dataclasses import dataclass
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent
GRAPHHOPPER_DIR = BACKEND_ROOT / "graphhopper"
CLEAN_MODEL = GRAPHHOPPER_DIR / "clean.json"
CLEAN_STRICT_MODEL = GRAPHHOPPER_DIR / "clean-strict.json"


def load_env_file() -> None:
    """Load backend/.env without overriding variables already set."""
    path = BACKEND_ROOT / ".env"
    if not path.is_file():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


@dataclass(frozen=True)
class Settings:
    graphhopper_url: str
    air_database: Path
    ai_gateway_api_key: str
    ai_model: str
    cors_origins: list[str]


def get_settings() -> Settings:
    load_env_file()
    origins = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    )
    database = Path(
        os.getenv("AIR_DATABASE", str(BACKEND_ROOT / "data" / "air.sqlite"))
    )
    if not database.is_absolute():
        database = BACKEND_ROOT / database
    return Settings(
        graphhopper_url=os.getenv("GRAPHHOPPER_URL", "http://127.0.0.1:8989"),
        air_database=database,
        ai_gateway_api_key=os.getenv("AI_GATEWAY_API_KEY", ""),
        ai_model=os.getenv("AI_MODEL", "openai/gpt-5.4"),
        cors_origins=[item.strip() for item in origins.split(",") if item.strip()],
    )
