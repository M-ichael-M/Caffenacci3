from __future__ import annotations
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import List, Optional
from datetime import datetime


# ── Stałe ──────────────────────────────────────────────────────────────────

ALLOWED_PLATFORMS = {"instagram", "facebook", "x", "tiktok", "other"}
MAX_EXCEPTION_DAYS_AHEAD = 21  # 3 tygodnie — egzekwowane też po stronie API


# ── Godziny tygodniowe ───────────────────────────────────────────────────────

class WeeklyHoursIn(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    open_time:   Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    close_time:  Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")


class WeeklyHoursOut(WeeklyHoursIn):
    id: str
    model_config = {"from_attributes": True}


# ── Wyjątki godzinowe (konkretne daty) ───────────────────────────────────────

class HourExceptionIn(BaseModel):
    date:       str  = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    is_closed:  bool = False
    open_time:  Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    close_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")

    @field_validator("close_time")
    @classmethod
    def validate_hours_pair(cls, v, info):
        # Jeśli nie zamknięte, oba pola godzin muszą być razem podane lub razem puste
        is_closed = info.data.get("is_closed", False)
        open_time = info.data.get("open_time")
        if not is_closed:
            if (open_time is None) != (v is None):
                raise ValueError("open_time i close_time muszą być podane razem (chyba że is_closed=true).")
        return v


class HourExceptionOut(BaseModel):
    id:         str
    date:       str
    is_closed:  bool
    open_time:  Optional[str]
    close_time: Optional[str]
    model_config = {"from_attributes": True}


# ── Social media ──────────────────────────────────────────────────────────

class SocialLinkIn(BaseModel):
    platform: str = Field(..., max_length=30)
    url:      str = Field(..., min_length=3, max_length=500)
    label:    Optional[str] = Field(None, max_length=100)
    visible:  bool = True
    position: int  = Field(0, ge=0)

    @field_validator("platform")
    @classmethod
    def validate_platform(cls, v: str) -> str:
        if v not in ALLOWED_PLATFORMS:
            raise ValueError(f"Nieprawidłowa platforma. Dozwolone: {', '.join(sorted(ALLOWED_PLATFORMS))}")
        return v


class SocialLinkOut(SocialLinkIn):
    id: str
    model_config = {"from_attributes": True}


# ── Pracownicy ───────────────────────────────────────────────────────────────

class EmployeeIn(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    role:      str = Field(..., min_length=2, max_length=100)
    bio:       Optional[str] = Field(None, max_length=1000)
    visible:   bool = True
    position:  int  = Field(0, ge=0)


class EmployeeOut(EmployeeIn):
    id: str
    model_config = {"from_attributes": True}


# ── Pełny profil — zapis (PUT) ────────────────────────────────────────────
# Logo wgrywane jest osobnym endpointem (multipart), więc tu nie występuje.

class CafeProfileIn(BaseModel):
    # Dane z rejestracji — edytowalne tu
    owner_name:  str = Field(..., min_length=2, max_length=100)
    phone:       str = Field(..., min_length=7, max_length=30)
    cafe_name:   str = Field(..., min_length=2, max_length=150)
    country:         str = Field(..., min_length=2, max_length=100)
    city:            str = Field(..., min_length=2, max_length=100)
    street:          str = Field(..., min_length=2, max_length=150)
    building_number: str = Field(..., min_length=1, max_length=20)
    postal_code:     str = Field(..., min_length=3, max_length=20)

    # Kontakt kawiarni — opcjonalny, widoczność zarządzana
    contact_email:         Optional[str] = Field(None, max_length=255)
    contact_email_visible: bool = False
    contact_phone:         Optional[str] = Field(None, max_length=30)
    contact_phone_visible: bool = False

    # Opis
    description:         Optional[str] = Field(None, max_length=2000)
    description_visible: bool = False

    # Godziny — obowiązkowe (min. jeden dzień otwarty), zawsze publiczne
    weekly_hours: List[WeeklyHoursIn] = Field(..., min_length=7, max_length=7)

    # Social media i pracownicy — opcjonalne listy
    social_links: List[SocialLinkIn] = []
    employees:    List[EmployeeIn]   = []

    @field_validator("weekly_hours")
    @classmethod
    def validate_all_days_present(cls, v: List[WeeklyHoursIn]) -> List[WeeklyHoursIn]:
        days = {h.day_of_week for h in v}
        if days != set(range(7)):
            raise ValueError("Plan tygodniowy musi zawierać dokładnie 7 dni (0-6), po jednym wpisie na dzień.")
        return v


# ── Pełny profil — odczyt (GET, dla właściciela) ────────────────────────────

class CafeProfileOut(BaseModel):
    id:      str
    cafe_id: str

    # Z rejestracji
    owner_name: str
    email:      EmailStr           # logowania — niezmienne tutaj, zawsze prywatny
    phone:      str
    cafe_name:  str
    country:         str
    city:            str
    street:          str
    building_number: str
    postal_code:     str

    contact_email:         Optional[str]
    contact_email_visible: bool
    contact_phone:         Optional[str]
    contact_phone_visible: bool

    description:         Optional[str]
    description_visible: bool

    logo_url: Optional[str]   # pełny URL do pobrania, zbudowany przez backend
    logo_complete: bool       # True jeśli logo zostało wgrane (do walidacji "kompletności")

    weekly_hours:    List[WeeklyHoursOut]
    hour_exceptions: List[HourExceptionOut]
    social_links:    List[SocialLinkOut]
    employees:       List[EmployeeOut]

    profile_complete: bool   # True jeśli logo + godziny są uzupełnione (wymogi obowiązkowe)

    updated_at: Optional[datetime]


# ── Publiczny widok "wizytówki" ──────────────────────────────────────────────
# Zwraca WYŁĄCZNIE pola oznaczone jako widoczne / zawsze publiczne.
# Używane przez przyszłą stronę-wizytówkę kawiarni.

class PublicEmployeeOut(BaseModel):
    full_name: str
    role:      str
    bio:       Optional[str]


class PublicSocialLinkOut(BaseModel):
    platform: str
    url:      str
    label:    Optional[str]


class PublicWeeklyHoursOut(BaseModel):
    day_of_week: int
    open_time:   Optional[str]
    close_time:  Optional[str]


class PublicHourExceptionOut(BaseModel):
    date:       str
    is_closed:  bool
    open_time:  Optional[str]
    close_time: Optional[str]


class PublicCafeProfileOut(BaseModel):
    cafe_id:   str
    cafe_name: str  # zawsze publiczne

    # Adres — zawsze publiczny
    country:         str
    city:            str
    street:          str
    building_number: str
    postal_code:     str

    # Warunkowo widoczne (None jeśli właściciel wyłączył)
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    description:   Optional[str] = None

    logo_url: Optional[str]

    # Zawsze publiczne, obowiązkowe
    weekly_hours:    List[PublicWeeklyHoursOut]
    hour_exceptions: List[PublicHourExceptionOut]

    # Tylko widoczne wpisy
    social_links: List[PublicSocialLinkOut]
    employees:    List[PublicEmployeeOut]