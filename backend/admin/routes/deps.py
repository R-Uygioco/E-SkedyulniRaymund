from fastapi import Depends, Header

from ..core.errors import UnauthorizedError
from ..runtime import auth_service, database


def get_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedError()
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise UnauthorizedError()
    return token


def require_admin(token: str = Depends(get_token)):
    with database.session() as session:
        profile = auth_service.verify(session, token)
        return {
            "userId": str(profile.user_id),
            "username": profile.username,
            "email": profile.email,
            "fullName": profile.full_name,
            "role": profile.role,
        }
