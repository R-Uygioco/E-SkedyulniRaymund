from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.errors import ConflictError, NotFoundError
from ..models.admin_profile import AdminProfile
from ..models.organization import Organization
from ..models.organization_membership import OrganizationMembership
from ..repositories.organization_membership_repository import OrganizationMembershipRepository
from ..repositories.organization_repository import OrganizationRepository


class OrganizationMembershipService:
    """Membership and assignment operations for administrator accounts."""

    def __init__(self, session: Session):
        self.session = session
        self.organizations = OrganizationRepository(session)
        self.memberships = OrganizationMembershipRepository(session)

    def join(self, organization_id: str, user_id: UUID):
        organization = self.organizations.get(organization_id)
        if organization.status != "active":
            raise ConflictError("You can only join an active organization.")
        if self.memberships.get(organization_id, user_id):
            raise ConflictError("You have already joined this organization.")

        membership = OrganizationMembership(
            organization_id=organization_id,
            user_id=user_id,
            joined_at=datetime.now(timezone.utc),
        )
        self.memberships.add(membership)
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise ConflictError("You have already joined this organization.") from exc
        self.session.refresh(membership)
        return organization, membership

    def join_by_code(self, join_code: str, user_id: UUID):
        organization = self.organizations.by_join_code(join_code.strip().upper())
        if not organization:
            raise ConflictError("The join code is invalid.")
        return self.join(organization.id, user_id)

    def mine(self, user_id: UUID):
        return self.memberships.list_for_user(user_id)

    def available(self, user_id: UUID, query: str | None = None):
        return self.memberships.list_available_for_user(user_id, query)

    def list_members(self, organization_id: str):
        organization = self.organizations.get(organization_id)
        statement = (
            select(OrganizationMembership, AdminProfile)
            .join(AdminProfile, AdminProfile.user_id == OrganizationMembership.user_id)
            .where(OrganizationMembership.organization_id == organization_id)
            .order_by(AdminProfile.username.asc())
        )
        rows = self.session.execute(statement).all()
        return [
            {
                "organizationId": organization.id,
                "organizationName": organization.name,
                "userId": str(profile.user_id),
                "username": profile.username,
                "email": profile.email,
                "fullName": profile.full_name,
                "joinedAt": membership.joined_at.isoformat(),
                "message": "Administrator membership.",
            }
            for membership, profile in rows
        ]

    def list_assignable_admins(self, organization_id: str, query: str | None = None):
        self.organizations.get(organization_id)
        assigned_ids = select(OrganizationMembership.user_id).where(
            OrganizationMembership.organization_id == organization_id
        )
        statement = (
            select(AdminProfile)
            .where(
                AdminProfile.active.is_(True),
                AdminProfile.role == "admin",
                AdminProfile.user_id.not_in(assigned_ids),
            )
            .order_by(AdminProfile.username.asc())
        )
        if query and query.strip():
            pattern = f"%{query.strip()}%"
            statement = statement.where(
                or_(
                    AdminProfile.username.ilike(pattern),
                    AdminProfile.email.ilike(pattern),
                    AdminProfile.full_name.ilike(pattern),
                )
            )
        profiles = self.session.scalars(statement)
        return [
            {
                "userId": str(profile.user_id),
                "username": profile.username,
                "email": profile.email,
                "fullName": profile.full_name,
            }
            for profile in profiles
        ]

    def assign_member(self, organization_id: str, user_id: UUID):
        organization = self.organizations.get(organization_id)
        profile = self.session.get(AdminProfile, user_id)
        if not profile or not profile.active or profile.role != "admin":
            raise NotFoundError("An active administrator with that user ID was not found.")
        if organization.status != "active":
            raise ConflictError("You can only assign administrators to an active organization.")
        if self.memberships.get(organization_id, user_id):
            raise ConflictError("This administrator is already assigned to the organization.")

        membership = OrganizationMembership(
            organization_id=organization_id,
            user_id=user_id,
            joined_at=datetime.now(timezone.utc),
        )
        self.session.add(membership)
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise ConflictError("This administrator is already assigned to the organization.") from exc
        self.session.refresh(membership)
        return organization, profile, membership

    def remove_member(self, organization_id: str, user_id: UUID) -> None:
        self.organizations.get(organization_id)
        membership = self.memberships.get(organization_id, user_id)
        if not membership:
            raise ConflictError("This administrator is not a member of the organization.")
        self.session.delete(membership)
        self.session.commit()
