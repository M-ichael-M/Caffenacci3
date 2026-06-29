import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime,
    ForeignKey, Text, Enum as SAEnum, Time
)
from sqlalchemy.dialects.sqlite import TEXT
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class TableType(str, enum.Enum):
    standard = "standard"       # 1-osobowe, 2-osobowe, itd.
    communal = "communal"       # wspólny stół – miejsca rezerwowane pojedynczo
    special  = "special"        # wyjątkowe stoliki (np. huśtawki)


class ReservationStatus(str, enum.Enum):
    confirmed = "confirmed"
    cancelled = "cancelled"


# ── Ustawienia systemu rezerwacji ──────────────────────────────────────────

class ReservationSettings(Base):
    """Jeden wiersz na kawiarnię – globalne ustawienia."""
    __tablename__ = "reservation_settings"

    id                    = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    cafe_id               = Column(TEXT, ForeignKey("cafes.id", ondelete="CASCADE"),
                                   nullable=False, unique=True, index=True)
    enabled               = Column(Boolean, nullable=False, default=False)
    mode                  = Column(String(20), nullable=False, default="simple")  # "simple" | "advanced"
    # Czas między rezerwacjami (minuty)
    slot_duration_minutes = Column(Integer, nullable=False, default=60)

    tables   = relationship("CafeTable", back_populates="settings",
                            cascade="all, delete-orphan")
    hours    = relationship("DayHours",  back_populates="settings",
                            cascade="all, delete-orphan")


class DayHours(Base):
    """Godziny rezerwacji dla każdego dnia tygodnia (0=pon … 6=nd)."""
    __tablename__ = "reservation_day_hours"

    id          = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    settings_id = Column(TEXT, ForeignKey("reservation_settings.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    day_of_week = Column(Integer, nullable=False)          # 0–6
    open_time   = Column(String(5), nullable=True)         # "HH:MM" lub NULL (dzień zamknięty)
    close_time  = Column(String(5), nullable=True)

    settings = relationship("ReservationSettings", back_populates="hours")


# ── Stoliki ────────────────────────────────────────────────────────────────

class CafeTable(Base):
    __tablename__ = "cafe_tables"

    id          = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    settings_id = Column(TEXT, ForeignKey("reservation_settings.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    table_type  = Column(SAEnum(TableType), nullable=False, default=TableType.standard)
    seats       = Column(Integer, nullable=False)           # liczba miejsc
    quantity    = Column(Integer, nullable=False, default=1) # ile takich stolików (tylko dla standard)
    label       = Column(String(200), nullable=True)        # opis dla special / etykieta

    settings     = relationship("ReservationSettings", back_populates="tables")
    reservations = relationship("Reservation", back_populates="table",
                                cascade="all, delete-orphan")


# ── Rezerwacje ─────────────────────────────────────────────────────────────

class Reservation(Base):
    __tablename__ = "reservations"

    id            = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    table_id      = Column(TEXT, ForeignKey("cafe_tables.id", ondelete="CASCADE"),
                           nullable=False, index=True)
    cafe_id       = Column(TEXT, ForeignKey("cafes.id", ondelete="CASCADE"),
                           nullable=False, index=True)

    # Data i czas (ISO string "YYYY-MM-DD HH:MM")
    date          = Column(String(10), nullable=False, index=True)   # YYYY-MM-DD
    start_time    = Column(String(5),  nullable=False)               # HH:MM

    guests        = Column(Integer, nullable=False)
    guest_name    = Column(String(150), nullable=False)
    guest_phone   = Column(String(30), nullable=True)
    guest_email   = Column(String(255), nullable=True)
    comment       = Column(Text, nullable=True)

    # Kto dokonał rezerwacji
    client_id     = Column(TEXT, nullable=True)   # id klienta jeśli przez portal; NULL = właściciel
    created_by_owner = Column(Boolean, nullable=False, default=False)

    status        = Column(SAEnum(ReservationStatus), nullable=False,
                           default=ReservationStatus.confirmed)
    created_at    = Column(DateTime, nullable=False, default=datetime.utcnow)

    table = relationship("CafeTable", back_populates="reservations")