from typing import Literal

from pydantic import BaseModel, Field, field_validator


JoinRequestStatus = Literal["pending", "approved", "rejected"]


class JoinCodeValidationRequest(BaseModel):
    joinCode: str = Field(min_length=1, max_length=32)

    @field_validator("joinCode")
    @classmethod
    def trim_join_code(cls, value: str) -> str:
        value = value.strip().upper()
        if not value:
            raise ValueError("Join code is required.")
        return value


class JoinCodeValidationResponse(BaseModel):
    id: str
    name: str
    category: str
    status: str
    message: str


class PublicJoinRequestCreate(BaseModel):
    memberName: str = Field(min_length=2, max_length=150)
    joinCode: str = Field(min_length=1, max_length=32)

    @field_validator("memberName")
    @classmethod
    def normalize_member_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 2:
            raise ValueError("Please enter your name.")
        return value

    @field_validator("joinCode")
    @classmethod
    def normalize_join_code(cls, value: str) -> str:
        value = value.strip().upper()
        if not value:
            raise ValueError("Join code is required.")
        return value


class JoinRequestDecisionRequest(BaseModel):
    decision: Literal["approved", "rejected"]
    note: str = Field(default="", max_length=1000)

    @field_validator("note")
    @classmethod
    def trim_note(cls, value: str) -> str:
        return value.strip()


class OrganizationJoinRequestResponse(BaseModel):
    id: str
    organizationId: str
    organizationName: str
    memberName: str
    submittedJoinCode: str
    status: JoinRequestStatus
    requestedAt: str
    reviewedAt: str | None
    reviewerNote: str
    message: str


class PublicJoinRequestCreatedResponse(BaseModel):
    id: str
    organizationId: str
    organizationName: str
    memberName: str
    submittedJoinCode: str
    status: JoinRequestStatus
    requestedAt: str
    reviewedAt: str | None
    reviewerNote: str
    message: str


class PublicJoinRequestStatusResponse(BaseModel):
    id: str
    organizationName: str
    status: JoinRequestStatus
    requestedAt: str
    reviewedAt: str | None
    reviewerNote: str
    message: str
