from uuid import UUID

from fastapi import APIRouter, Header

from ..core.errors import ServiceUnavailableError, UnauthorizedError
from ..models.admin_profile import AdminProfile
from ..runtime import database, supabase_service
from ..schemas.join_request import (
    PublicJoinRequestCreate,
    PublicJoinRequestCreatedResponse,
    PublicJoinRequestStatusResponse,
)
from ..services.organization_join_request_service import OrganizationJoinRequestService

router = APIRouter(prefix="/public/join-requests", tags=["Public Join Requests"])


def resolve_optional_member_identity(session, authorization: str | None):
    """Resolve a member identity from a verified Supabase token when supplied.

    Anonymous join requests remain supported for compatibility, but they cannot
    create an organization membership when approved.
    """
    if not authorization:
        return None, None, ""

    scheme, separator, token = authorization.partition(" ")
    if not separator or scheme.lower() != "bearer" or not token.strip():
        raise UnauthorizedError("Invalid authorization header.")

    if not supabase_service.configured():
        raise ServiceUnavailableError("Supabase authentication is not configured.")

    try:
        response = supabase_service.verifier_client().auth.get_user(token.strip())
        user = getattr(response, "user", None)
        user_id = UUID(str(user.id))
    except Exception as exc:
        raise UnauthorizedError("The member session is invalid or expired.") from exc

    # Admin accounts use the separate admin assignment table and should not be
    # silently treated as ordinary member accounts.
    if session.get(AdminProfile, user_id):
        raise UnauthorizedError("Please submit member join requests using a member account.")

    email = getattr(user, "email", None)
    metadata = getattr(user, "user_metadata", None)
    if not isinstance(metadata, dict):
        metadata = {}
    full_name = str(metadata.get("full_name") or metadata.get("name") or "").strip()
    return user_id, email, full_name


def to_public_status_response(request):
    return {
        "id": request.id,
        "organizationName": request.organization.name,
        "status": request.status,
        "requestedAt": request.requested_at.isoformat(),
        "reviewedAt": request.reviewed_at.isoformat() if request.reviewed_at else None,
        "reviewerNote": request.reviewer_note,
        "message": (
            "Your request is waiting for administrator review."
            if request.status == "pending"
            else f"Your request was {request.status}."
        ),
    }


def to_created_response(request):
    return {
        **to_public_status_response(request),
        "organizationId": request.organization_id,
        "memberName": request.member_name,
        "submittedJoinCode": request.submitted_join_code,
    }


@router.post("", response_model=PublicJoinRequestCreatedResponse, status_code=201)
def create_join_request(
    data: PublicJoinRequestCreate,
    authorization: str | None = Header(default=None),
):
    with database.session() as session:
        member_user_id, member_email, member_full_name = resolve_optional_member_identity(
            session, authorization
        )
        request = OrganizationJoinRequestService(session).create(
            data,
            member_user_id=member_user_id,
            member_email=member_email,
            member_full_name=member_full_name,
        )
        session.refresh(request)
        return to_created_response(request)


@router.get("/{request_id}", response_model=PublicJoinRequestStatusResponse)
def get_join_request_status(request_id: str):
    with database.session() as session:
        request = OrganizationJoinRequestService(session).get_public_status(request_id)
        return to_public_status_response(request)
