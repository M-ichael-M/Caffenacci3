from __future__ import annotations
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import datetime

from app.schemas.gallery import PublicGalleryImageOut

# ── Dostępne szablony i palety kolorów ──────────────────────────────────────
# Trzymane jako proste klucze (string) — wygląd (kolory, typografia, animacje)
# jest renderowany po stronie frontendu na podstawie tego klucza. Backend tylko
# waliduje, że klucz jest jednym z dozwolonych.
#
# classic    — elegancki, tradycyjny, przytulny klimat kawiarni
# modern     — minimalistyczny, płaski, geometryczny
# magic      — mroczny magiczny klimat, świecące akcenty, dym, gwiazdy
# usa80s     — neonowy amerykański diner z lat 80.
# expressive — odważne kształty i duże fonty w duchu Material 3 Expressive

ALLOWED_TEMPLATES = {"classic", "modern", "magic", "usa80s", "expressive"}

ALLOWED_PALETTES = {
    "espresso-gold",
    "forest-sage",
    "midnight-berry",
    "ocean-breeze",
    "rose-latte",
    "sunset-amber",
}


# ── Ustawienia strony (właściciel) ──────────────────────────────────────────

class CafeSiteSettingsIn(BaseModel):
    template: str = Field("classic")
    palette:  str = Field("espresso-gold")

    @field_validator("template")
    @classmethod
    def validate_template(cls, v: str) -> str:
        if v not in ALLOWED_TEMPLATES:
            raise ValueError(f"Nieprawidłowy szablon. Dozwolone: {', '.join(sorted(ALLOWED_TEMPLATES))}")
        return v

    @field_validator("palette")
    @classmethod
    def validate_palette(cls, v: str) -> str:
        if v not in ALLOWED_PALETTES:
            raise ValueError(f"Nieprawidłowa paleta. Dozwolone: {', '.join(sorted(ALLOWED_PALETTES))}")
        return v


class CafeSiteSettingsOut(BaseModel):
    id:       str
    cafe_id:  str
    template: str
    palette:  str
    model_config = {"from_attributes": True}


# ── Publiczna strona kawiarni — pełny bundle do wyrenderowania ─────────────
# Wszystkie zagnieżdżone modele mają from_attributes=True, bo są budowane
# bezpośrednio z obiektów SQLAlchemy (relacje ORM), nie ze słowników.

class PublicWeeklyHoursOut(BaseModel):
    day_of_week: int
    open_time:   Optional[str]
    close_time:  Optional[str]
    model_config = {"from_attributes": True}


class PublicHourExceptionOut(BaseModel):
    date:       str
    is_closed:  bool
    open_time:  Optional[str]
    close_time: Optional[str]
    model_config = {"from_attributes": True}


class PublicSocialLinkOut(BaseModel):
    platform: str
    url:      str
    label:    Optional[str]
    model_config = {"from_attributes": True}


class PublicEmployeeOut(BaseModel):
    full_name: str
    role:      str
    bio:       Optional[str]
    model_config = {"from_attributes": True}


class SiteMenuItemOut(BaseModel):
    id:             str
    name:           str
    description:    Optional[str]
    price:          float
    is_vege:        bool
    is_hot:         bool
    is_unavailable: bool
    model_config = {"from_attributes": True}


class SiteMenuSectionOut(BaseModel):
    id:    str
    name:  str
    items: List[SiteMenuItemOut]
    model_config = {"from_attributes": True}


class SiteReviewOut(BaseModel):
    id:         str
    nick:       str
    rating:     int
    comment:    Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}

class SiteLoyaltyRewardOut(BaseModel):
    id: str
    name: str
    cost_points: int
    model_config = {"from_attributes": True}


class PublicSiteOut(BaseModel):
    cafe_id:   str
    cafe_name: str
    template:  str
    palette:   str

    country:         str
    city:            str
    street:          str
    building_number: str
    postal_code:     str

    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    description:   Optional[str] = None
    logo_url:      Optional[str] = None

    latitude:  Optional[float] = None
    longitude: Optional[float] = None
    location_show_map:        bool = False
    location_show_gmaps_link: bool = False

    weekly_hours:    List[PublicWeeklyHoursOut]
    hour_exceptions: List[PublicHourExceptionOut]
    social_links:    List[PublicSocialLinkOut]
    employees:       List[PublicEmployeeOut]

    menu_sections: List[SiteMenuSectionOut]

    orders_enabled:       bool
    reservations_enabled: bool
    reservations_mode:    str

    reviews_average: float
    reviews_count:   int
    reviews:         List[SiteReviewOut]

    loyalty_enabled: bool = False
    loyalty_mode: str = "points"
    loyalty_stamps_max: int = 10
    loyalty_stamps_earn_desc: Optional[str] = None
    loyalty_stamps_reward_desc: Optional[str] = None
    loyalty_rewards: List[SiteLoyaltyRewardOut] = []

    # Pusta lista, jeśli właściciel wyłączył galerię lub nie dodał zdjęć.
    gallery_images: List[PublicGalleryImageOut] = []