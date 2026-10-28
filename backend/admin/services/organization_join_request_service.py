from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ..core.errors import ConflictError, NotFoundError
from ..core.join_codes import normalize_join_code
from ..models.member_profile import MemberProfile
from ..models.organization_member_account import OrganizationMemberAccount
from ..models.organization_join_request import OrganizationJoinRequest
from ..repositories.organization_repository import OrganizationRepository
from ..schemas.join_request import JoinRequestDecisionRequest, PublicJoinRequestCreate


class OrganizationJoinRequestService:
    def __init__(self, session: Session):
        self.session = session
        self.organizations = OrganizationRepository(session)

    def validate_code(self, join_code: str):
        code = normalize_join_code(join_code)
        organization = self.organizations.by_join_code(code)
        if not organization or organization.status != "active":
            raise NotFoundError("That join code is invalid or the organization is inactive.")
        return organization

    def create(
        self,
        data: PublicJoinRequestCreate,
        member_user_id: UUID | None = None,
        member_email: str | None = None,
        member_full_name: str = "",
    ):
        code = normalize_join_code(data.joinCode)
        organization = self.validate_code(code)
        member_name = " ".join(data.memberName.split())

        if member_user_id is not None:
            profile = self.session.get(MemberProfile, member_user_id)
            if profile and not profile.active:
                raise ConflictError("This member account is inactive.")
            if profile is None:
                self.session.add(
                    MemberProfile(
                        user_id=member_user_id,
                        email=member_email,
                        full_name=member_full_name.strip() or member_name,
                        active=True,
                        created_at=datetime.now(timezone.utc),
                    )
                )
            else:
                if member_email:
                    profile.email = member_email
                if member_full_name.strip() and not profile.full_name.strip():
                    profile.full_name = member_full_name.strip()

            pending_query = select(OrganizationJoinRequest).where(
                OrganizationJoinRequest.organization_id == organization.id,
                OrganizationJoinRequest.status == "pending",
                OrganizationJoinRequest.member_user_id == member_user_id,
            )
            duplicate_message = "A pending request already exists for this member and organization."
        else:
            pending_query = select(OrganizationJoinRequest).where(
                OrganizationJoinRequest.organization_id == organization.id,
                OrganizationJoinRequest.status == "pending",
                OrganizationJoinRequest.member_user_id.is_(None),
                func.lower(OrganizationJoinRequest.member_name) == member_name.lower(),
            )
            duplicate_message = "A pending request for this name already exists for this organization."

        if self.session.scalar(pending_query):
            raise ConflictError(duplicate_message)

        request = OrganizationJoinRequest(
            id=uuid4().hex,
            organization_id=organization.id,
            member_user_id=member_user_id,
            member_name=member_name,
            submitted_join_code=code,
            status="pending",
            requested_at=datetime.now(timezone.utc),
            reviewed_at=None,
            reviewed_by=None,
            reviewer_note="",
        )
        self.session.add(request)
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise ConflictError(duplicate_message) from exc
        self.session.refresh(request)
        return request

    def get_public_status(self, request_id: str):
        request = self.session.get(OrganizationJoinRequest, request_id)
        if not request:
            raise NotFoundError("Join request not found.")
        return request

    def list_requests(self, status: str = "all"):
        statement = select(OrganizationJoinRequest).options(
            selectinload(OrganizationJoinRequest.organization)
        ).order_by(OrganizationJoinRequest.requested_at.desc())
        if status != "all":
            statement = statement.where(OrganizationJoinRequest.status == status)
        return list(self.session.scalars(statement))

    def decide(self, request_id: str, decision: JoinRequestDecisionRequest, reviewer_id: UUID):
        request = self.session.get(OrganizationJoinRequest, request_id)
        if not request:
            raise NotFoundError("Join request not found.")
        if request.status != "pending":
            raise ConflictError("This join request has already been reviewed.")

        organization = self.organizations.get(request.organization_id)
        if decision.decision == "approved" and organization.status != "active":
            raise ConflictError(
                "The organization is inactive. Activate it before approving a request."
            )

        now = datetime.now(timezone.utc)
        if decision.decision == "approved" and request.member_user_id is not None:
            member = self.session.get(MemberProfile, request.member_user_id)
            if not member or not member.active:
                raise ConflictError("The member account is missing or inactive; the request cannot be approved.")
            existing_membership = self.session.scalar(
                select(OrganizationMemberAccount).where(
                    OrganizationMemberAccount.organization_id == request.organization_id,
                    OrganizationMemberAccount.user_id == request.member_user_id,
                )
            )
            if existing_membership:
                raise ConflictError("This member already belongs to the organization.")

            self.session.add(
                OrganizationMemberAccount(
                    organization_id=request.organization_id,
                    user_id=request.member_user_id,
                    joined_at=now,
                )
            )

        request.status = decision.decision
        request.reviewed_at = now
        request.reviewed_by = reviewer_id
        request.reviewer_note = decision.note.strip()
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise ConflictError("The request or membership changed concurrently. Refresh and try again.") from exc
        self.session.refresh(request)
        return request

    def delete(self, request_id: str) -> None:
        request = self.session.get(OrganizationJoinRequest, request_id)
        if not request:
            raise NotFoundError("Join request not found.")
        self.session.delete(request)
        self.session.commit()
