from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.validators import (
    clean,
    normalize_phone,
    validate_password,
    MSG_FULL_NAME,
    MSG_NICK_LENGTH,
    MSG_NICK_CHARS,
)


class ClientRegisterIn(BaseModel):
    full_name: str = Field(..., examples=["Anna Kowalska"])
    nick: str = Field(..., examples=["anna_k"])
    email: EmailStr
    phone: Optional[str] = Field(None, examples=["+48123456789"])
    password: str = Field(..., examples=["Mocne#Haslo1"])
    password_confirm: str
    accept_terms: bool
    accept_privacy: bool

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        v = clean(v)
        if not 2 <= len(v) <= 150:
            raise ValueError(MSG_FULL_NAME)
        return v

    @field_validator("nick")
    @classmethod
    def validate_nick(cls, v: str) -> str:
        v = v.strip()
        if not 3 <= len(v) <= 40:
            raise ValueError(MSG_NICK_LENGTH)
        core = v.replace("_", "").replace(".", "")
        if not core.isalnum():
            raise ValueError(MSG_NICK_CHARS)
        return v

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str) -> str:
        return v.lower()

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        return normalize_phone(v.strip())

    @field_validator("password")
    @classmethod
    def validate_pwd(cls, v: str) -> str:
        return validate_password(v)

    @field_validator("password_confirm")
    @classmethod
    def validate_password_match(cls, v, info):
        pwd = info.data.get("password")
        if pwd and v != pwd:
            raise ValueError("Hasła nie są identyczne.")
        return v

    @field_validator("accept_terms")
    @classmethod
    def validate_terms(cls, v):
        if not v:
            raise ValueError("Akceptacja regulaminu jest wymagana.")
        return v

    @field_validator("accept_privacy")
    @classmethod
    def validate_privacy(cls, v):
        if not v:
            raise ValueError("Akceptacja polityki prywatności jest wymagana.")
        return v


class ClientRegisterOut(BaseModel):
    id: str
    nick: str
    email: EmailStr
    message: str = "Konto zostało pomyślnie utworzone."


class ClientLoginIn(BaseModel):
    email: EmailStr
    password: str


class ClientTokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    nick: str
    full_name: str


class ClientProfileOut(BaseModel):
    id: str
    full_name: str
    nick: str
    email: EmailStr
    phone: Optional[str]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class NickAvailabilityOut(BaseModel):
    nick: str
    available: bool


class EmailAvailabilityOut(BaseModel):
    email: str
    available: bool
