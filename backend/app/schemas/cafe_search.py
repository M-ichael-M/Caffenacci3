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
    # Klucze maks. 3 wyróżnionych plakietek (patrz app/schemas/badges.py) —
    # front (caffenacci.customer) mapuje je na etykietę/ikonę do wyświetlenia
    # w kafelku kawiarni.
    featured_badges: List[str] = []


class CafeSearchListOut(BaseModel):
    results: List[CafeSearchResultOut]
    count: int

# ── Lista wszystkich zarejestrowanych kawiarni (bez filtra publikacji) ────
# Używane m.in. przez aplikację pracowniczą do wyboru kawiarni przed
# zalogowaniem pracownika — w odróżnieniu od /cafes/search, nie wymaga
# opublikowanej strony ani aktywnej subskrypcji.

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