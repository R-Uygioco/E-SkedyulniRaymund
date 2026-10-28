from fastapi import APIRouter

from .auth import router as auth_router
from .dashboard import router as dashboard_router
from .events import router as events_router
from .organizations import router as organizations_router
from .public_organizations import router as public_organizations_router
from .public_join_requests import router as public_join_requests_router
from .join_requests import router as join_requests_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(dashboard_router)
api_router.include_router(organizations_router)
api_router.include_router(events_router)
api_router.include_router(public_organizations_router)
api_router.include_router(public_join_requests_router)
api_router.include_router(join_requests_router)
