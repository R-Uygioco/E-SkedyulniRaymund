from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from admin.core.errors import ConflictError, NotFoundError
from admin.database import Base
from admin.models.admin_profile import AdminProfile
from admin.models.member_profile import MemberProfile
from admin.models.organization_member_account import OrganizationMemberAccount
from admin.models.organization_join_request import OrganizationJoinRequest
from admin.models.organization import Organization
from admin.schemas.join_request import JoinRequestDecisionRequest, PublicJoinRequestCreate
from admin.services.organization_join_request_service import OrganizationJoinRequestService
from admin.services.organization_membership_service import OrganizationMembershipService


@pytest.fixture
def session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        now = datetime.now(timezone.utc)
        db.add_all([
            AdminProfile(
                user_id=uuid4(), username="test-admin", email="test-admin@example.com",
                full_name="Test Admin", role="admin", active=True, created_at=now,
            ),
            AdminProfile(
                user_id=uuid4(), username="other-admin", email="other-admin@example.com",
                full_name="Other Admin", role="admin", active=True, created_at=now,
            ),
        ])
        db.add_all([
            Organization(
                id="org-active", name="Active Organization", description="",
                contact_email="active@example.com", phone="", timezone="Asia/Manila",
                address="", category="General", status="active",
                join_code="ESK-ACTIVE01", created_at=now,
            ),
            Organization(
                id="org-inactive", name="Inactive Organization", description="",
                contact_email="inactive@example.com", phone="", timezone="Asia/Manila",
                address="", category="General", status="inactive",
                join_code="ESK-INACTIVE", created_at=now,
            ),
        ])
        db.commit()
        yield db
    engine.dispose()


def test_admin_can_join_an_active_organization_using_code(session):
    admin = session.query(AdminProfile).filter_by(username="test-admin").one()
    service = OrganizationMembershipService(session)
    organization, membership = service.join_by_code(" esk-active01 ", admin.user_id)
    assert organization.id == "org-active"
    assert membership.user_id == admin.user_id
    assert service.mine(admin.user_id)[0].id == "org-active"


def test_admin_cannot_join_with_invalid_code(session):
    admin = session.query(AdminProfile).filter_by(username="test-admin").one()
    with pytest.raises(ConflictError, match="invalid"):
        OrganizationMembershipService(session).join_by_code("BAD-CODE", admin.user_id)


def test_admin_cannot_join_inactive_organization_by_code(session):
    admin = session.query(AdminProfile).filter_by(username="test-admin").one()
    with pytest.raises(ConflictError, match="active organization"):
        OrganizationMembershipService(session).join_by_code("ESK-INACTIVE", admin.user_id)


def test_admin_can_assign_and_remove_another_admin(session):
    target = session.query(AdminProfile).filter_by(username="other-admin").one()
    service = OrganizationMembershipService(session)
    organization, profile, membership = service.assign_member("org-active", target.user_id)
    assert organization.id == "org-active"
    assert profile.username == "other-admin"
    assert membership.user_id == target.user_id
    assert any(row["userId"] == str(target.user_id) for row in service.list_members("org-active"))

    service.remove_member("org-active", target.user_id)
    assert all(row["userId"] != str(target.user_id) for row in service.list_members("org-active"))


def test_assignable_admins_excludes_existing_members(session):
    target = session.query(AdminProfile).filter_by(username="other-admin").one()
    service = OrganizationMembershipService(session)
    candidates = service.list_assignable_admins("org-active")
    assert any(row["userId"] == str(target.user_id) for row in candidates)

    service.assign_member("org-active", target.user_id)
    candidates_after = service.list_assignable_admins("org-active")
    assert all(row["userId"] != str(target.user_id) for row in candidates_after)


def test_anonymous_request_approval_records_decision_without_creating_membership(session):
    admin = session.query(AdminProfile).filter_by(username="test-admin").one()
    service = OrganizationJoinRequestService(session)
    request = service.create(PublicJoinRequestCreate(memberName="  Alex   Santos ", joinCode=" esk-active01 "))
    assert request.organization_id == "org-active"
    assert request.member_name == "Alex Santos"
    assert request.member_user_id is None
    assert request.status == "pending"

    reviewed = service.decide(
        request.id,
        JoinRequestDecisionRequest(decision="approved", note="Welcome."),
        admin.user_id,
    )
    assert reviewed.status == "approved"
    assert reviewed.reviewer_note == "Welcome."
    assert reviewed.reviewed_by == admin.user_id
    assert session.query(OrganizationMemberAccount).filter_by(
        organization_id="org-active"
    ).count() == 0


def test_authenticated_member_request_approval_creates_membership(session):
    admin = session.query(AdminProfile).filter_by(username="test-admin").one()
    member_user_id = uuid4()
    service = OrganizationJoinRequestService(session)

    request = service.create(
        PublicJoinRequestCreate(memberName="Jordan Lee", joinCode="ESK-ACTIVE01"),
        member_user_id=member_user_id,
        member_email="jordan@example.com",
        member_full_name="Jordan Lee",
    )
    assert request.member_user_id == member_user_id
    member_profile = session.get(MemberProfile, member_user_id)
    assert member_profile is not None
    assert member_profile.email == "jordan@example.com"

    reviewed = service.decide(
        request.id,
        JoinRequestDecisionRequest(decision="approved", note="Welcome."),
        admin.user_id,
    )
    assert reviewed.status == "approved"

    membership = session.get(OrganizationMemberAccount, ("org-active", member_user_id))
    assert membership is not None
    assert membership.organization_id == "org-active"
    assert membership.user_id == member_user_id


def test_authenticated_member_cannot_create_two_pending_requests(session):
    member_user_id = uuid4()
    service = OrganizationJoinRequestService(session)
    service.create(
        PublicJoinRequestCreate(memberName="Jordan Lee", joinCode="ESK-ACTIVE01"),
        member_user_id=member_user_id,
        member_email="jordan@example.com",
        member_full_name="Jordan Lee",
    )

    with pytest.raises(ConflictError, match="pending request"):
        service.create(
            PublicJoinRequestCreate(memberName="Jordan Lee Changed", joinCode="ESK-ACTIVE01"),
            member_user_id=member_user_id,
            member_email="jordan@example.com",
            member_full_name="Jordan Lee",
        )


def test_two_authenticated_members_with_same_name_can_request_membership(session):
    service = OrganizationJoinRequestService(session)
    for email in ("alex1@example.com", "alex2@example.com"):
        service.create(
            PublicJoinRequestCreate(memberName="Alex Santos", joinCode="ESK-ACTIVE01"),
            member_user_id=uuid4(),
            member_email=email,
            member_full_name="Alex Santos",
        )

    assert session.query(OrganizationJoinRequest).filter_by(
        organization_id="org-active", status="pending"
    ).count() == 2


def test_public_member_cannot_submit_using_inactive_organization_code(session):
    service = OrganizationJoinRequestService(session)
    with pytest.raises(NotFoundError, match="invalid or the organization is inactive"):
        service.create(PublicJoinRequestCreate(memberName="Alex Santos", joinCode="ESK-INACTIVE"))


def test_pending_request_cannot_be_reviewed_twice(session):
    admin = session.query(AdminProfile).filter_by(username="test-admin").one()
    service = OrganizationJoinRequestService(session)
    request = service.create(PublicJoinRequestCreate(memberName="Jordan Lee", joinCode="ESK-ACTIVE01"))
    service.decide(request.id, JoinRequestDecisionRequest(decision="rejected"), admin.user_id)
    with pytest.raises(ConflictError, match="already been reviewed"):
        service.decide(request.id, JoinRequestDecisionRequest(decision="approved"), admin.user_id)


def test_duplicate_pending_request_for_same_name_is_rejected(session):
    service = OrganizationJoinRequestService(session)
    service.create(PublicJoinRequestCreate(memberName="Casey Reyes", joinCode="ESK-ACTIVE01"))
    with pytest.raises(ConflictError, match="pending request"):
        service.create(PublicJoinRequestCreate(memberName=" casey reyes ", joinCode="ESK-ACTIVE01"))
