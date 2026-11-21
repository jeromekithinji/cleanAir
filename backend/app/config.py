"""Process settings. Copy backend/.env.example and fill in secrets locally."""

import os
from dataclasses import dataclass
from pathlib import Path


def load_env_file() -> None:
    """Load backend/.env without overriding variables already in the process."""
    path = Path(__file__).resolve().parents[1] / ".env"
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
    valhalla_url: str
    ai_gateway_api_key: str
    ai_model: str
    cors_origins: list[str]


def get_settings() -> Settings:
    load_env_file()
    origins = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    )
    return Settings(
        valhalla_url=os.getenv(
            "VALHALLA_URL",
            "https://valhalla1.openstreetmap.de",
        ),
        ai_gateway_api_key=os.getenv("AI_GATEWAY_API_KEY", ""),
        ai_model=os.getenv("AI_MODEL", "openai/gpt-5.4"),
        cors_origins=[item.strip() for item in origins.split(",") if item.strip()],
    )
