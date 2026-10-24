from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..runtime import database
from ..schemas.join_request import (
    JoinRequestDecisionRequest,
    OrganizationJoinRequestResponse,
)
from ..services.organization_join_request_service import OrganizationJoinRequestService
from .deps import require_admin

router = APIRouter(prefix="/admin/join-requests", tags=["Admin Join Requests"])


def to_admin_response(request):
    return {
        "id": request.id,
        "organizationId": request.organization_id,
        "organizationName": request.organization.name,
        "memberName": request.member_name,
        "submittedJoinCode": request.submitted_join_code,
        "status": request.status,
        "requestedAt": request.requested_at.isoformat(),
        "reviewedAt": request.reviewed_at.isoformat() if request.reviewed_at else None,
        "reviewerNote": request.reviewer_note,
        "message": (
            "Waiting for administrator review."
            if request.status == "pending"
            else f"Request {request.status}."
        ),
    }


@router.get("", response_model=list[OrganizationJoinRequestResponse])
def list_join_requests(
    status_filter: str = Query(
        default="all",
        alias="status",
        pattern="^(pending|approved|rejected|all)$",
    ),
    _: dict = Depends(require_admin),
):
    with database.session() as session:
        requests = OrganizationJoinRequestService(session).list_requests(status_filter)
        return [to_admin_response(item) for item in requests]


@router.patch("/{request_id}/decision", response_model=OrganizationJoinRequestResponse)
def decide_join_request(
    request_id: str,
    data: JoinRequestDecisionRequest,
    current_admin: dict = Depends(require_admin),
):
    with database.session() as session:
        request = OrganizationJoinRequestService(session).decide(
            request_id,
            data,
            UUID(current_admin["userId"]),
        )
        return to_admin_response(request)


@router.delete("/{request_id}")
def delete_join_request(
    request_id: str,
    _: dict = Depends(require_admin),
):
    with database.session() as session:
        OrganizationJoinRequestService(session).delete(request_id)
        return {"message": "Join request deleted successfully."}
