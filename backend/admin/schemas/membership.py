from pydantic import BaseModel, Field, field_validator


class JoinByCodeRequest(BaseModel):
    joinCode: str = Field(min_length=1, max_length=32)

    @field_validator("joinCode")
    @classmethod
    def trim_join_code(cls, value: str) -> str:
        value = value.strip().upper()
        if not value:
            raise ValueError("Join code is required.")
        return value


class OrganizationMembershipResponse(BaseModel):
    organizationId: str
    organizationName: str
    userId: str
    joinedAt: str
    message: str


class OrganizationMemberDetailResponse(BaseModel):
    organizationId: str
    organizationName: str
    userId: str
    username: str
    email: str
    fullName: str
    joinedAt: str
    message: str


class AdminAccountCandidateResponse(BaseModel):
    userId: str
    username: str
    email: str
    fullName: str
