from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.errors import ConflictError
from ..core.join_codes import generate_join_code, normalize_join_code
from ..core.timekeeping import get_zone
from ..core.validation import raise_duplicate
from ..models.organization import Organization
from ..repositories.organization_repository import OrganizationRepository
from ..schemas.organization import OrganizationCreate, OrganizationUpdate


class OrganizationService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = OrganizationRepository(session)

    def list(self, query, status):
        return self.repo.list(query, status)

    def get(self, organization_id):
        return self.repo.get(organization_id)

    def _unique_join_code(self, requested_code: str | None, exclude_id: str | None = None) -> str:
        if requested_code:
            code = normalize_join_code(requested_code)
            if self.repo.join_code_exists(code, exclude_id):
                raise_duplicate("That join code is already assigned to another organization.")
            return code

        for _ in range(20):
            code = generate_join_code()
            if not self.repo.join_code_exists(code, exclude_id):
                return code

        raise ConflictError("Unable to generate a unique join code. Please try again.")

    def create(self, data: OrganizationCreate):
        if self.repo.name_exists(data.name):
            raise_duplicate("An organization with this name already exists.")

        item = Organization(
            id=uuid4().hex,
            name=data.name.strip(),
            description=data.description.strip(),
            contact_email=str(data.contactEmail),
            phone=data.phone.strip(),
            timezone=data.timezone.strip(),
            address=data.address.strip(),
            category=data.category.strip() or "General",
            status=data.status,
            join_code=self._unique_join_code(data.joinCode),
            created_at=datetime.now(timezone.utc),
        )
        get_zone(item.timezone)
        self.session.add(item)
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise ConflictError("The organization name or join code is already in use.") from exc
        self.session.refresh(item)
        return item

    def update(self, organization_id, data: OrganizationUpdate):
        item = self.repo.get(organization_id)
        if self.repo.name_exists(data.name, organization_id):
            raise_duplicate("An organization with this name already exists.")

        get_zone(data.timezone)
        item.name = data.name.strip()
        item.description = data.description.strip()
        item.contact_email = str(data.contactEmail)
        item.phone = data.phone.strip()
        item.timezone = data.timezone.strip()
        item.address = data.address.strip()
        item.category = data.category.strip() or "General"
        item.status = data.status

        # Blank/null means keep the current code during a normal edit.
        if data.joinCode:
            item.join_code = self._unique_join_code(data.joinCode, exclude_id=organization_id)

        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise ConflictError("The organization name or join code is already in use.") from exc
        self.session.refresh(item)
        return item

    def regenerate_join_code(self, organization_id: str) -> Organization:
        item = self.repo.get(organization_id)
        item.join_code = self._unique_join_code(None, exclude_id=organization_id)
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise ConflictError("Unable to generate a unique join code. Please try again.") from exc
        self.session.refresh(item)
        return item

    def toggle(self, organization_id):
        item = self.repo.get(organization_id)
        item.status = "inactive" if item.status == "active" else "active"
        self.session.commit()
        self.session.refresh(item)
        return item

    def delete(self, organization_id):
        item = self.repo.get(organization_id)
        if self.repo.count_events(organization_id):
            raise ConflictError(
                "This organization still has events. Delete or move those events before deleting the organization."
            )
        self.session.delete(item)
        self.session.commit()
