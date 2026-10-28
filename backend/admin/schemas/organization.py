from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class OrganizationBase(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str = Field(default="", max_length=5000)
    contactEmail: EmailStr
    phone: str = Field(default="", max_length=50)
    timezone: str = Field(default="Asia/Manila", min_length=1, max_length=80)
    address: str = Field(default="", max_length=255)
    category: str = Field(default="General", max_length=100)
    status: Literal["active", "inactive"] = "active"
    joinCode: str | None = Field(default=None, max_length=32)

    @field_validator("name", "timezone")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field is required.")
        return value

    @field_validator("joinCode")
    @classmethod
    def normalize_optional_join_code(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        return value.strip().upper()


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationUpdate(OrganizationBase):
    pass


class OrganizationView(OrganizationBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    createdAt: str
