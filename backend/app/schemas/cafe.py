from pydantic import BaseModel, EmailStr, Field


# ---------- Rejestracja ----------

class AddressIn(BaseModel):
    country: str = Field(..., min_length=2, max_length=100, examples=["Polska"])
    city: str = Field(..., min_length=2, max_length=100, examples=["Warszawa"])
    street: str = Field(..., min_length=2, max_length=150, examples=["Marszałkowska"])
    building_number: str = Field(..., min_length=1, max_length=20, examples=["12A"])
    postal_code: str = Field(..., min_length=3, max_length=20, examples=["00-001"])


class RegisterIn(BaseModel):
    owner_name: str = Field(..., min_length=2, max_length=100, examples=["Jan Kowalski"])
    cafe_name: str = Field(..., min_length=2, max_length=150, examples=["Kawiarnia Pod Lipą"])
    email: EmailStr
    phone: str = Field(..., min_length=7, max_length=30, examples=["+48 123 456 789"])
    password: str = Field(..., min_length=8, examples=["Mocne#Haslo1"])
    address: AddressIn


class RegisterOut(BaseModel):
    id: str
    cafe_name: str
    email: EmailStr
    message: str = "Konto zostało pomyślnie utworzone."


# ---------- Logowanie ----------

class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    cafe_id: str
    cafe_name: str
    owner_name: str


# ---------- Profil (opcjonalnie do użycia w chronionych endpointach) ----------

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
