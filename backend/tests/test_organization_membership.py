
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from admin.core.errors import ConflictError
from admin.database import Base
from admin.models.admin_profile import AdminProfile
from admin.models.organization import Organization
from admin.services.organization_membership_service import (
    OrganizationMembershipService,
)


@pytest.fixture
def session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as db_session:
        yield db_session

    engine.dispose()


def seed_admin_and_organizations(session):
    user_id = uuid4()
    now = datetime.now(timezone.utc)

    session.add(
        AdminProfile(
            user_id=user_id,
            username="test-admin",
            email="test-admin@example.com",
            full_name="Test Admin",
            role="admin",
            active=True,
            created_at=now,
        )
    )

    session.add_all(
        [
            Organization(
                id="org-active",
                name="Active Organization",
                description="",
                contact_email="active@example.com",
                phone="",
                timezone="Asia/Manila",
                address="",
                category="General",
                status="active",
                created_at=now,
            ),
            Organization(
                id="org-inactive",
                name="Inactive Organization",
                description="",
                contact_email="inactive@example.com",
                phone="",
                timezone="Asia/Manila",
                address="",
                category="General",
                status="inactive",
                created_at=now,
            ),
        ]
    )

    session.commit()
    return user_id


def test_admin_can_join_active_organization(session):
    user_id = seed_admin_and_organizations(session)
    service = OrganizationMembershipService(session)

    organization, membership = service.join(
        "org-active",
        user_id,
    )

    assert organization.name == "Active Organization"
    assert membership.user_id == user_id

    assert [
        item.id for item in service.mine(user_id)
    ] == ["org-active"]

    assert service.available(user_id) == []


def test_admin_cannot_join_same_organization_twice(session):
    user_id = seed_admin_and_organizations(session)
    service = OrganizationMembershipService(session)

    service.join("org-active", user_id)

    with pytest.raises(ConflictError, match="already joined"):
        service.join("org-active", user_id)


def test_admin_cannot_join_inactive_organization(session):
    user_id = seed_admin_and_organizations(session)
    service = OrganizationMembershipService(session)

    with pytest.raises(ConflictError, match="active organization"):
        service.join("org-inactive", user_id)
