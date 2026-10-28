from fastapi import APIRouter, Depends

from ..runtime import database
from ..services.dashboard_service import DashboardService
from ..services.event_service import EventService
from ..services.organization_join_request_service import OrganizationJoinRequestService
from ..services.organization_service import OrganizationService
from .deps import require_admin
from .events import to_response as event_to_response
from .join_requests import to_admin_response as join_request_to_response
from .organizations import to_response as organization_to_response

router = APIRouter(prefix="/admin/dashboard", tags=["Admin Dashboard"])


@router.get("")
def dashboard(_: dict = Depends(require_admin)):
    with database.session() as session:
        summary = DashboardService(session).summary()
        summary["nextEvents"] = [event_to_response(event) for event in summary["nextEvents"]]
        return summary


@router.get("/bootstrap")
def admin_bootstrap(_: dict = Depends(require_admin)):
    """Load the datasets required by the Admin workspace in one API request."""
    with database.session() as session:
        organizations = OrganizationService(session).list(None, None)
        events = EventService(session).list(None, None)
        requests = OrganizationJoinRequestService(session).list_requests("all")
        return {
            "organizations": [organization_to_response(item) for item in organizations],
            "events": [event_to_response(item) for item in events],
            "joinRequests": [join_request_to_response(item) for item in requests],
        }
