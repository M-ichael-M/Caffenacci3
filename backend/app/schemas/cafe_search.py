from __future__ import annotations
from pydantic import BaseModel
from typing import List, Optional


class TodayHoursOut(BaseModel):
    is_closed: bool
    open_time: Optional[str] = None
    close_time: Optional[str] = None


class CafeSearchResultOut(BaseModel):
    cafe_id: str
    slug: str
    cafe_name: str
    country: str
    city: str
    street: str
    building_number: str
    postal_code: str
    logo_url: Optional[str] = None
    today_hours: Optional[TodayHoursOut] = None
    featured_badges: List[str] = []

    # ── Dane do filtrów / kafelka ─────────────────────────────────────
    average_rating: Optional[float] = None
    review_count: int = 0
    distance_km: Optional[float] = None      # tylko gdy podano lat/lng
    is_open_now: Optional[bool] = None       # None = brak danych o godzinach
    open_days: List[int] = []                # 0=pn … 6=nd (plan tygodniowy)
    reservations_enabled: bool = False
    orders_enabled: bool = False
    badges: List[str] = []                   # wszystkie klucze plakietek
    visited: Optional[bool] = None           # None = niezalogowany


class CafeSearchListOut(BaseModel):
    results: List[CafeSearchResultOut]
    count: int


class CafeSearchMetaOut(BaseModel):
    countries: List[str]                     # kraje, w których są opublikowane kawiarnie
    detected_country_code: Optional[str] = None   # ISO 3166-1 alpha-2 z CDN, jeśli dostępny


# ── Lista wszystkich zarejestrowanych kawiarni (bez filtra publikacji) ────

class CafeListItemOut(BaseModel):
    id: str
    cafe_name: str
    city: str
    street: str
    building_number: str
    slug: Optional[str] = None


class CafeListOut(BaseModel):
    cafes: List[CafeListItemOut]
    count: int


# ── Punkty na mapie ───────────────────────────────────────────────────────

class CafeMapPointOut(BaseModel):
    cafe_id: str
    slug: str
    cafe_name: str
    latitude: float
    longitude: float
    is_open_now: Optional[bool] = None
    open_time: Optional[str] = None
    close_time: Optional[str] = None
    closed_today: bool = False


class CafeMapOut(BaseModel):
    cafes: List[CafeMapPointOut]
    count: int
