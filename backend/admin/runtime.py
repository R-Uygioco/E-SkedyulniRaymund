"""Shared runtime services and a single SQLAlchemy connection pool."""

from .config import Settings
from .database import Database
from .services.auth_service import AuthService
from .supabase import SupabaseService

settings = Settings.from_env()
database = Database(settings.database_url)
supabase_service = SupabaseService(settings)
auth_service = AuthService(settings, supabase_service)
