from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .organization import Organization


class OrganizationJoinRequest(Base):
    __tablename__ = "organization_join_requests"
    __table_args__ = (
        Index(
            "uq_pending_join_request_by_member",
            "organization_id",
            "member_user_id",
            unique=True,
            postgresql_where=text("status = 'pending' AND member_user_id IS NOT NULL"),
            sqlite_where=text("status = 'pending' AND member_user_id IS NOT NULL"),
        ),
        Index(
            "uq_pending_join_request_anonymous_by_name",
            "organization_id",
            text("lower(member_name)"),
            unique=True,
            postgresql_where=text("status = 'pending' AND member_user_id IS NULL"),
            sqlite_where=text("status = 'pending' AND member_user_id IS NULL"),
        ),
        Index("ix_join_requests_status_requested", "status", "requested_at"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        String(40), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    member_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("member_profiles.user_id", ondelete="SET NULL"), nullable=True
    )
    member_name: Mapped[str] = mapped_column(String(150), nullable=False)
    submitted_join_code: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("admin_profiles.user_id", ondelete="SET NULL"), nullable=True
    )
    reviewer_note: Mapped[str] = mapped_column(Text, default="", nullable=False)

    organization: Mapped["Organization"] = relationship()
