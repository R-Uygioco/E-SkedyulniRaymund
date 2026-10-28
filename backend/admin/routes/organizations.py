from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..runtime import database
from ..schemas.common import OrganizationResponse
from ..schemas.organization import OrganizationCreate, OrganizationUpdate
from ..schemas.membership import (
    OrganizationMembershipResponse,
    OrganizationMemberDetailResponse,
    AdminAccountCandidateResponse,
)
from ..services.organization_service import OrganizationService
from ..services.organization_membership_service import OrganizationMembershipService
from .deps import require_admin

router = APIRouter(prefix="/admin/organizations", tags=["Admin Organizations"])


def to_response(item):
    return {
        "id": item.id,
        "name": item.name,
        "description": item.description,
        "contactEmail": item.contact_email,
        "phone": item.phone,
        "timezone": item.timezone,
        "address": item.address,
        "category": item.category,
        "status": item.status,
        "joinCode": item.join_code,
        "createdAt": item.created_at.date().isoformat(),
    }


@router.get("", response_model=list[OrganizationResponse])
def list_organizations(
    query: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    _: dict = Depends(require_admin),
):
    with database.session() as session:
        return [to_response(item) for item in OrganizationService(session).list(query, status_filter)]


@router.post("", response_model=OrganizationResponse, status_code=201)
def create_organization(data: OrganizationCreate, _: dict = Depends(require_admin)):
    with database.session() as session:
        return to_response(OrganizationService(session).create(data))


@router.get("/available", response_model=list[OrganizationResponse])
def list_available_organizations(query: str | None = Query(default=None), current_admin: dict = Depends(require_admin)):
    with database.session() as session:
        rows = OrganizationMembershipService(session).available(UUID(current_admin["userId"]), query)
        return [to_response(item) for item in rows]


@router.get("/mine", response_model=list[OrganizationResponse])
def list_my_organizations(current_admin: dict = Depends(require_admin)):
    with database.session() as session:
        rows = OrganizationMembershipService(session).mine(UUID(current_admin["userId"]))
        return [to_response(item) for item in rows]


@router.post("/{organization_id}/regenerate-join-code", response_model=OrganizationResponse)
def regenerate_organization_join_code(organization_id: str, _: dict = Depends(require_admin)):
    with database.session() as session:
        return to_response(OrganizationService(session).regenerate_join_code(organization_id))


@router.get("/{organization_id}/members", response_model=list[OrganizationMemberDetailResponse])
def list_organization_members(organization_id: str, _: dict = Depends(require_admin)):
    with database.session() as session:
        return OrganizationMembershipService(session).list_members(organization_id)


@router.get("/{organization_id}/assignable-administrators", response_model=list[AdminAccountCandidateResponse])
def list_assignable_administrators(
    organization_id: str,
    query: str | None = Query(default=None),
    _: dict = Depends(require_admin),
):
    with database.session() as session:
        return OrganizationMembershipService(session).list_assignable_admins(organization_id, query)


@router.post("/{organization_id}/members/{user_id}", response_model=OrganizationMembershipResponse, status_code=201)
def assign_administrator_to_organization(
    organization_id: str,
    user_id: UUID,
    _: dict = Depends(require_admin),
):
    with database.session() as session:
        organization, profile, membership = OrganizationMembershipService(session).assign_member(
            organization_id, user_id
        )
        return {
            "organizationId": organization.id,
            "organizationName": organization.name,
            "userId": str(profile.user_id),
            "joinedAt": membership.joined_at.isoformat(),
            "message": f"{profile.username} was assigned to {organization.name}.",
        }


@router.delete("/{organization_id}/members/{user_id}")
def remove_organization_member(organization_id: str, user_id: UUID, _: dict = Depends(require_admin)):
    with database.session() as session:
        OrganizationMembershipService(session).remove_member(organization_id, user_id)
        return {"message": "Administrator removed from the organization."}


@router.post("/{organization_id}/join", response_model=OrganizationMembershipResponse, status_code=201)
def join_organization(organization_id: str, current_admin: dict = Depends(require_admin)):
    with database.session() as session:
        organization, membership = OrganizationMembershipService(session).join(
            organization_id, UUID(current_admin["userId"])
        )
        return {
            "organizationId": organization.id,
            "organizationName": organization.name,
            "userId": str(current_admin["userId"]),
            "joinedAt": membership.joined_at.isoformat(),
            "message": f"You joined {organization.name} successfully.",
        }


@router.get("/{organization_id}", response_model=OrganizationResponse)
def get_organization(organization_id: str, _: dict = Depends(require_admin)):
    with database.session() as session:
        return to_response(OrganizationService(session).get(organization_id))


@router.put("/{organization_id}", response_model=OrganizationResponse)
def update_organization(organization_id: str, data: OrganizationUpdate, _: dict = Depends(require_admin)):
    with database.session() as session:
        return to_response(OrganizationService(session).update(organization_id, data))


@router.patch("/{organization_id}/toggle-status", response_model=OrganizationResponse)
def toggle_organization(organization_id: str, _: dict = Depends(require_admin)):
    with database.session() as session:
        return to_response(OrganizationService(session).toggle(organization_id))


@router.delete("/{organization_id}")
def delete_organization(organization_id: str, _: dict = Depends(require_admin)):
    with database.session() as session:
        OrganizationService(session).delete(organization_id)
        return {"message": "Organization deleted successfully."}
