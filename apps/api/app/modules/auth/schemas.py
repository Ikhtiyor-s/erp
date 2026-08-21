from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    twofa_code: str | None = None


class TwoFASetupOut(BaseModel):
    secret: str
    otpauth_url: str
    backup_codes: list[str]


class TwoFAVerifyRequest(BaseModel):
    code: str


class TwoFADisableRequest(BaseModel):
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    organization_name: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str | None = None
    locale: str = "ru"
