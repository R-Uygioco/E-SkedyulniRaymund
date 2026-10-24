from threading import Lock

from supabase import Client, create_client

from .config import Settings


class SupabaseService:
    """Create Auth clients and reuse one client for read-only token checks."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self._verifier_client: Client | None = None
        self._verifier_lock = Lock()

    def auth_client(self) -> Client:
        return create_client(self.settings.supabase_url, self.settings.supabase_publishable_key)

    def verifier_client(self) -> Client:
        if self._verifier_client is None:
            with self._verifier_lock:
                if self._verifier_client is None:
                    self._verifier_client = create_client(
                        self.settings.supabase_url,
                        self.settings.supabase_publishable_key,
                    )
        return self._verifier_client

    def admin_client(self) -> Client:
        return create_client(self.settings.supabase_url, self.settings.supabase_secret_key)

    def configured(self) -> bool:
        return bool(self.settings.supabase_url and self.settings.supabase_publishable_key)
