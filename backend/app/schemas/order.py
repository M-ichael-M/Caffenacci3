from __future__ import annotations
from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum
from datetime import datetime

MAX_ORDER_DAYS_AHEAD = 3


# ── Enums ──────────────────────────────────────────────────────────────────

class OrderStatusEnum(str, Enum):
    pending   = "pending"
    completed = "completed"
    cancelled = "cancelled"


# ── Ustawienia ─────────────────────────────────────────────────────────────

class OrderSettingsIn(BaseModel):
    enabled: bool = False


class OrderSettingsOut(BaseModel):
    id:      str
    cafe_id: str
    enabled: bool
    model_config = {"from_attributes": True}


# ── Pozycje zamówienia ───────────────────────────────────────────────────

class OrderItemIn(BaseModel):
    menu_item_id: Optional[str] = Field(None, max_length=100)
    name:         str   = Field(..., min_length=1, max_length=200)
    price:        float = Field(..., ge=0)
    quantity:     int   = Field(..., ge=1, le=100)


class OrderItemOut(BaseModel):
    id:           str
    menu_item_id: Optional[str]
    name:         str
    price:        float
    quantity:     int
    model_config = {"from_attributes": True}


# ── Zamówienie publiczne (od klienta, bez logowania) ──────────────────────

class PublicOrderIn(BaseModel):
    """Formularz klienta — system kont jeszcze nie istniał, gdy powstał ten endpoint."""
    client_nick: str = Field(..., min_length=2, max_length=60, examples=["Kasia_W"])
    client_id:   Optional[str] = Field(None, max_length=100)
    date:        str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    start_time:  str = Field(..., pattern=r"^\d{2}:\d{2}$")
    items:       List[OrderItemIn] = Field(..., min_length=1, max_length=100)


class PublicOrderCancelIn(BaseModel):
    """Klient anuluje własne zamówienie — autoryzacja przez client_id."""
    client_id: Optional[str] = Field(None, max_length=100)


# ── Zamówienie od zalogowanego klienta (strona kawiarni) ──────────────────
# nick i client_id NIE są przyjmowane z formularza — pochodzą z tokenu JWT,
# żeby nie dało się podszyć pod innego klienta.

class ClientOrderIn(BaseModel):
    date:       str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    start_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    items:      List[OrderItemIn] = Field(..., min_length=1, max_length=100)


# ── Zmiana statusu (właściciel) ───────────────────────────────────────────

class OrderStatusUpdate(BaseModel):
    status: OrderStatusEnum  # completed | cancelled


# ── Output ─────────────────────────────────────────────────────────────────
# Celowo NIE zawiera client_id — ten identyfikator nie jest widoczny
# dla właściciela kawiarni, tylko wykorzystywany wewnętrznie do autoryzacji
# anulowania przez klienta.

class OrderOut(BaseModel):
    id:           str
    cafe_id:      str
    client_nick:  str
    date:         str
    start_time:   str
    items:        List[OrderItemOut]
    total_value:  float
    status:       OrderStatusEnum
    cancelled_by: Optional[str]
    created_at:   Optional[datetime]
    model_config = {"from_attributes": True}


class OrderListOut(BaseModel):
    orders: List[OrderOut]

# ── "Moje zamówienia" — połączony widok klienta (wszystkie kawiarnie) ────

class ClientOrderOut(OrderOut):
    cafe_name: str


class ClientOrderListOut(BaseModel):
    orders: List[ClientOrderOut]