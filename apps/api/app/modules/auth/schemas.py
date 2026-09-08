from pydantic import BaseModel, Field


class RequestRegisterOtpIn(BaseModel):
    phone: str


class VerifyRegisterOtpIn(BaseModel):
    phone: str
    code: str


class LoginRequest(BaseModel):
    phone: str
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
    ticket: str
    phone: str
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
    phone: str | None = None
    email: str | None = None
    full_name: str | None = None
    locale: str = "ru"
