from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..core.errors import NotFoundError
from ..models.event import Event

class EventRepository:
    def __init__(self, session: Session):
        self.session = session

    def list(self, query: str | None, status: str | None):
        statement = select(Event).options(selectinload(Event.organization)).order_by(Event.starts_at.asc())
        if query:
            statement = statement.where(Event.title.ilike(f"%{query.strip()}%"))
        if status:
            statement = statement.where(Event.status == status)
        return list(self.session.scalars(statement))

    def get(self, event_id: str) -> Event:
        item = self.session.scalar(select(Event).options(selectinload(Event.organization)).where(Event.id == event_id))
        if not item:
            raise NotFoundError("Event not found.")
        return item

    def conflict(self, organization_id: str, location: str, starts_at, ends_at, exclude_id: str | None = None):
        statement = select(Event).options(selectinload(Event.organization)).where(
            Event.status != "cancelled",
            Event.starts_at < ends_at,
            Event.ends_at > starts_at,
            or_(
                Event.organization_id == organization_id,
                func.lower(Event.location) == location.strip().lower(),
            ),
        )
        if exclude_id:
            statement = statement.where(Event.id != exclude_id)
        return self.session.scalar(statement)
