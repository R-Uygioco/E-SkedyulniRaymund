from fastapi import APIRouter

from ..runtime import auth_service, database
from ..schemas.auth import LoginRequest, TokenResponse

router = APIRouter(prefix="/admin/auth", tags=["Admin Auth"])


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest):
    with database.session() as session:
        return auth_service.login(session, data.username, data.password)


@router.post("/logout")
def logout():
    return {"message": "Signed out successfully. The frontend should clear the Admin token."}
