from __future__ import annotations
from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


# ── Enums ──────────────────────────────────────────────────────────────────

class TableTypeEnum(str, Enum):
    standard = "standard"
    communal = "communal"
    special  = "special"


class ReservationStatusEnum(str, Enum):
    confirmed = "confirmed"
    cancelled = "cancelled"


# ── Dzień tygodnia ─────────────────────────────────────────────────────────

class DayHoursIn(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    open_time:   Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    close_time:  Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")


class DayHoursOut(DayHoursIn):
    id: str
    model_config = {"from_attributes": True}


# ── Stoliki ────────────────────────────────────────────────────────────────

class CafeTableIn(BaseModel):
    table_type: TableTypeEnum
    seats:      int = Field(..., ge=1, le=50)
    quantity:   int = Field(1, ge=1, le=100)   # dla standard; dla communal/special = 1
    label:      Optional[str] = Field(None, max_length=200)


class CafeTableOut(CafeTableIn):
    id: str
    model_config = {"from_attributes": True}


# ── Ustawienia ─────────────────────────────────────────────────────────────

class ReservationSettingsIn(BaseModel):
    enabled:               bool  = False
    mode:                  str   = Field("simple", pattern=r"^(simple|advanced)$")
    slot_duration_minutes: int   = Field(60, ge=15, le=480)
    tables:                List[CafeTableIn]  = []
    hours:                 List[DayHoursIn]   = []


class ReservationSettingsOut(BaseModel):
    id:                    str
    cafe_id:               str
    enabled:               bool
    mode:                  str
    slot_duration_minutes: int
    tables:                List[CafeTableOut] = []
    hours:                 List[DayHoursOut]  = []
    model_config = {"from_attributes": True}


# ── Rezerwacje ─────────────────────────────────────────────────────────────

class ReservationIn(BaseModel):
    table_id:    str
    date:        str  = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    start_time:  str  = Field(..., pattern=r"^\d{2}:\d{2}$")
    guests:      int  = Field(..., ge=1, le=50)
    guest_name:  str  = Field(..., min_length=1, max_length=150)
    guest_phone: Optional[str] = Field(None, max_length=30)
    guest_email: Optional[str] = Field(None, max_length=255)
    comment:     Optional[str] = Field(None, max_length=1000)
    client_id:   Optional[str] = None   # wypełnia portal klienta


class ReservationOut(BaseModel):
    id:               str
    table_id:         str
    cafe_id:          str
    date:             str
    start_time:       str
    guests:           int
    guest_name:       str
    guest_phone:      Optional[str]
    guest_email:      Optional[str]
    comment:          Optional[str]
    client_id:        Optional[str]
    created_by_owner: bool
    status:           ReservationStatusEnum
    # Denormalizowane dane stolika (dla wygody widoku)
    table_seats:      Optional[int]  = None
    table_type:       Optional[str]  = None
    table_label:      Optional[str]  = None
    model_config = {"from_attributes": True}


class ReservationListOut(BaseModel):
    date:         str
    reservations: List[ReservationOut]