from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.validators import (
    normalize_phone, validate_password, validate_owner_name, validate_cafe_name,
    validate_street, validate_building_number, validate_postal_code,
    validate_city, validate_country,
)


class AddressIn(BaseModel):
    country: str = Field(..., examples=["Polska"])
    city: str = Field(..., examples=["Warszawa"])
    street: str = Field(..., examples=["Marszałkowska"])
    building_number: str = Field(..., examples=["12A"])
    postal_code: str = Field(..., examples=["00-001"])

    _country = field_validator("country")(classmethod(lambda cls, v: validate_country(v)))
    _city = field_validator("city")(classmethod(lambda cls, v: validate_city(v)))
    _street = field_validator("street")(classmethod(lambda cls, v: validate_street(v)))
    _building = field_validator("building_number")(classmethod(lambda cls, v: validate_building_number(v)))
    _postal = field_validator("postal_code")(classmethod(lambda cls, v: validate_postal_code(v)))


class RegisterIn(BaseModel):
    owner_name: str = Field(..., examples=["Jan Kowalski"])
    cafe_name: str = Field(..., examples=["Kawiarnia Pod Lipą"])
    email: EmailStr
    phone: str = Field(..., examples=["+48123456789"])
    password: str = Field(..., examples=["Mocne#Haslo1"])
    address: AddressIn
    # Strefa z przeglądarki (Intl) — tylko sugestia; backend waliduje i w razie błędu bierze domyślną.
    time_zone: Optional[str] = Field(None, max_length=64, examples=["Asia/Phnom_Penh"])

    _owner = field_validator("owner_name")(classmethod(lambda cls, v: validate_owner_name(v)))
    _cafe = field_validator("cafe_name")(classmethod(lambda cls, v: validate_cafe_name(v)))
    _phone = field_validator("phone")(classmethod(lambda cls, v: normalize_phone(v.strip())))
    _pwd = field_validator("password")(classmethod(lambda cls, v: validate_password(v)))

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str) -> str:
        return v.lower()


class RegisterOut(BaseModel):
    id: str
    cafe_name: str
    email: EmailStr
    message: str = "Konto zostało pomyślnie utworzone."


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    cafe_id: str
    cafe_name: str
    owner_name: str


class CafeProfile(BaseModel):
    id: str
    owner_name: str
    cafe_name: str
    email: EmailStr
    phone: str
    country: str
    city: str
    street: str
    building_number: str
    postal_code: str

    model_config = {"from_attributes": True}


class EmailAvailabilityOut(BaseModel):
    email: str
    available: bool
