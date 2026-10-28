import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Resolve backend/.env regardless of the current working directory.
# Process environment values take precedence over values from the file.
load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)


@dataclass(frozen=True)
class Settings:
    database_url: str
    supabase_url: str
    supabase_publishable_key: str
    supabase_secret_key: str
    admin_username: str
    cors_origins: tuple[str, ...]
    auto_create_tables: bool

    @classmethod
    def from_env(cls) -> "Settings":
        default_origins = (
            "http://localhost:8443,http://127.0.0.1:8443,"
            "http://localhost:5173,http://127.0.0.1:5173"
        )
        origins = tuple(
            value.strip().rstrip("/")
            for value in os.getenv("CORS_ORIGINS", default_origins).split(",")
            if value.strip()
        )
        return cls(
            database_url=os.getenv("DATABASE_URL", ""),
            supabase_url=os.getenv("SUPABASE_URL", ""),
            supabase_publishable_key=os.getenv(
                "SUPABASE_PUBLISHABLE_KEY", os.getenv("SUPABASE_ANON_KEY", "")
            ),
            supabase_secret_key=os.getenv(
                "SUPABASE_SECRET_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
            ),
            admin_username=os.getenv("ADMIN_USERNAME", "admin"),
            cors_origins=origins,
            auto_create_tables=os.getenv("AUTO_CREATE_TABLES", "false").strip().lower() == "true",
        )
