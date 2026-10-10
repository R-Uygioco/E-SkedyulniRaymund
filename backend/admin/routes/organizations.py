from fastapi import APIRouter, Depends, Query

from ..config import Settings
from ..database import Database
from ..schemas.common import OrganizationResponse
from ..schemas.organization import OrganizationCreate, OrganizationUpdate
from ..services.organization_service import OrganizationService
from .deps import require_admin

router = APIRouter(prefix="/admin/organizations", tags=["Admin Organizations"])
settings = Settings.from_env()
database = Database(settings.database_url)

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
        "createdAt": item.created_at.date().isoformat(),
    }

@router.get("", response_model=list[OrganizationResponse])
def list_organizations(query: str | None = Query(default=None), status: str | None = Query(default=None), _: dict = Depends(require_admin)):
    with database.session() as session:
        return [to_response(item) for item in OrganizationService(session).list(query, status)]

@router.post("", response_model=OrganizationResponse, status_code=201)
def create_organization(data: OrganizationCreate, _: dict = Depends(require_admin)):
    with database.session() as session:
        return to_response(OrganizationService(session).create(data))

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
