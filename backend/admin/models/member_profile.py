from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Boolean, DateTime, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class MemberProfile(Base):
    """Profile for a non-administrator Supabase Auth user."""

    __tablename__ = "member_profiles"

    # Supabase's auth.users foreign key is defined in schema.sql/migrations.
    # It is omitted here so SQLite-backed unit tests can create this metadata.
    user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(String(150), default="", nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
