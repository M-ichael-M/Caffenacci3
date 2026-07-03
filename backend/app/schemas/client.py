from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime


class ClientRegisterIn(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150, examples=["Anna Kowalska"])
    nick: str = Field(..., min_length=3, max_length=40, examples=["anna_k"])
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=30)
    password: str = Field(..., min_length=8, examples=["Mocne#Haslo1"])
    password_confirm: str = Field(..., min_length=8)
    accept_terms: bool
    accept_privacy: bool

    @field_validator("nick")
    @classmethod
    def validate_nick(cls, v: str) -> str:
        v = v.strip()
        core = v.replace("_", "").replace(".", "")
        if not core.isalnum():
            raise ValueError("Nick może zawierać tylko litery, cyfry, kropki i podkreślenia.")
        return v

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