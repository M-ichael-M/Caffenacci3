import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime,
    ForeignKey, Text, Enum as SAEnum,
)
from sqlalchemy.dialects.sqlite import TEXT
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class TableType(str, enum.Enum):
    standard = "standard"
    communal = "communal"
    special  = "special"


class ReservationStatus(str, enum.Enum):
    pending   = "pending"     # nowa, czeka na decyzję właściciela
    confirmed = "confirmed"   # zaakceptowana przez właściciela
    cancelled = "cancelled"   # odrzucona / anulowana


# ── Ustawienia systemu rezerwacji ──────────────────────────────────────────

class ReservationSettings(Base):
    """Jeden wiersz na kawiarnię – globalne ustawienia."""
    __tablename__ = "reservation_settings"

    id                    = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    cafe_id               = Column(TEXT, ForeignKey("cafes.id", ondelete="CASCADE"),
                                   nullable=False, unique=True, index=True)
    enabled               = Column(Boolean, nullable=False, default=False)
    mode                  = Column(String(20), nullable=False, default="simple")
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
    day_of_week = Column(Integer, nullable=False)
    open_time   = Column(String(5), nullable=True)
    close_time  = Column(String(5), nullable=True)

    settings = relationship("ReservationSettings", back_populates="hours")


# ── Stoliki ────────────────────────────────────────────────────────────────

class CafeTable(Base):
    __tablename__ = "cafe_tables"

    id          = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    settings_id = Column(TEXT, ForeignKey("reservation_settings.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    table_type  = Column(SAEnum(TableType), nullable=False, default=TableType.standard)
    seats       = Column(Integer, nullable=False)
    quantity    = Column(Integer, nullable=False, default=1)
    label       = Column(String(200), nullable=True)

    settings     = relationship("ReservationSettings", back_populates="tables")
    reservations = relationship("Reservation", back_populates="table",
                                cascade="all, delete-orphan")


# ── Rezerwacje ─────────────────────────────────────────────────────────────

class Reservation(Base):
    __tablename__ = "reservations"

    id            = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    table_id      = Column(TEXT, ForeignKey("cafe_tables.id", ondelete="SET NULL"),
                           nullable=True, index=True)   # NULL dla simple mode
    cafe_id       = Column(TEXT, ForeignKey("cafes.id", ondelete="CASCADE"),
                           nullable=False, index=True)

    # Dane rezerwacji (prosty formularz klienta)
    date          = Column(String(10), nullable=False, index=True)   # YYYY-MM-DD
    start_time    = Column(String(5),  nullable=False)               # HH:MM
    guests        = Column(Integer, nullable=False)
    guest_name    = Column(String(150), nullable=False)
    guest_phone   = Column(String(30), nullable=True)
    guest_email   = Column(String(255), nullable=True)
    comment       = Column(Text, nullable=True)

    # Tryb i źródło
    client_id        = Column(TEXT, nullable=True)
    created_by_owner = Column(Boolean, nullable=False, default=False)

    # Status + odpowiedź właściciela
    status        = Column(SAEnum(ReservationStatus), nullable=False,
                           default=ReservationStatus.pending)
    owner_note    = Column(Text, nullable=True)   # wiadomość do klienta przy akceptacji/odrzuceniu

    created_at    = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at    = Column(DateTime, nullable=True, onupdate=datetime.utcnow)

    table = relationship("CafeTable", back_populates="reservations")