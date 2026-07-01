import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime,
    ForeignKey, Text, Float,
)
from sqlalchemy.dialects.sqlite import TEXT
from sqlalchemy.orm import relationship

from app.core.database import Base


# ── Profil kawiarni (1:1 z Cafe) ──────────────────────────────────────────
# Przechowuje dane "nowe" względem rejestracji: kontakt kawiarni, opis,
# logo, social media — wraz z flagami widoczności publicznej dla każdego
# pola, które właściciel może sam włączać/wyłączać.

class CafeProfile(Base):
    __tablename__ = "cafe_profiles"

    id      = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    cafe_id = Column(TEXT, ForeignKey("cafes.id", ondelete="CASCADE"),
                      nullable=False, unique=True, index=True)

    # ── Kontakt kawiarni (osobny od kontaktu właściciela) ──────────────────
    # Nieobowiązkowe — właściciel decyduje czy w ogóle podaje i czy publikuje.
    contact_email          = Column(String(255), nullable=True)
    contact_email_visible  = Column(Boolean, nullable=False, default=False)
    contact_phone          = Column(String(30), nullable=True)
    contact_phone_visible  = Column(Boolean, nullable=False, default=False)

    # ── Opis ─────────────────────────────────────────────────────────────
    description         = Column(Text, nullable=True)
    description_visible  = Column(Boolean, nullable=False, default=False)

    # ── Logo ─────────────────────────────────────────────────────────────
    # Obowiązkowe pole biznesowo (walidacja egzekwowana w warstwie API:
    # profil nie może zostać oznaczony jako "kompletny" bez logo),
    # ale w bazie trzymane jako nullable, bo konto może istnieć
    # zanim logo zostanie wgrane.
    logo_path = Column(String(500), nullable=True)  # ścieżka względna w /uploads

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)

    weekly_hours = relationship(
        "ProfileWeeklyHours", back_populates="profile",
        cascade="all, delete-orphan",
    )
    hour_exceptions = relationship(
        "ProfileHourException", back_populates="profile",
        cascade="all, delete-orphan",
    )
    social_links = relationship(
        "ProfileSocialLink", back_populates="profile",
        cascade="all, delete-orphan",
    )
    employees = relationship(
        "ProfileEmployee", back_populates="profile",
        cascade="all, delete-orphan", order_by="ProfileEmployee.position",
    )

    # ── Lokalizacja na mapie ─────────────────────────────────────────────
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    location_visible = Column(Boolean, nullable=False, default=False)
    location_show_map = Column(Boolean, nullable=False, default=True)
    location_show_gmaps_link = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)


# ── Plan tygodniowy godzin otwarcia ────────────────────────────────────────
# Zawsze publiczne, obowiązkowe. 0=poniedziałek ... 6=niedziela.
# Brak open_time/close_time = zamknięte tego dnia.

class ProfileWeeklyHours(Base):
    __tablename__ = "profile_weekly_hours"

    id          = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    profile_id  = Column(TEXT, ForeignKey("cafe_profiles.id", ondelete="CASCADE"),
                          nullable=False, index=True)
    day_of_week = Column(Integer, nullable=False)
    open_time   = Column(String(5), nullable=True)
    close_time  = Column(String(5), nullable=True)

    profile = relationship("CafeProfile", back_populates="weekly_hours")


# ── Wyjątki od planu tygodniowego (konkretna data) ─────────────────────────
# Nadpisuje plan tygodniowy dla danego dnia. UI ogranicza edycję do
# najbliższych 3 tygodni, ale backend tego nie wymusza sztywno (sensowne,
# żeby nie blokować np. odświeżenia po zmianie zakresu w przyszłości).
# is_closed=True oznacza "zamknięte tego dnia mimo planu tygodniowego".

class ProfileHourException(Base):
    __tablename__ = "profile_hour_exceptions"

    id          = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    profile_id  = Column(TEXT, ForeignKey("cafe_profiles.id", ondelete="CASCADE"),
                          nullable=False, index=True)
    date        = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    is_closed   = Column(Boolean, nullable=False, default=False)
    open_time   = Column(String(5), nullable=True)
    close_time  = Column(String(5), nullable=True)

    profile = relationship("CafeProfile", back_populates="hour_exceptions")


# ── Linki social media ──────────────────────────────────────────────────────
# Dowolna liczba linków, każdy z własną platformą i widocznością.

class ProfileSocialLink(Base):
    __tablename__ = "profile_social_links"

    id         = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    profile_id = Column(TEXT, ForeignKey("cafe_profiles.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    platform   = Column(String(30), nullable=False)   # instagram | facebook | x | tiktok | other
    url        = Column(String(500), nullable=False)
    label      = Column(String(100), nullable=True)    # np. nazwa "innego" profilu
    visible    = Column(Boolean, nullable=False, default=True)
    position   = Column(Integer, nullable=False, default=0)

    profile = relationship("CafeProfile", back_populates="social_links")


# ── Pracownicy ──────────────────────────────────────────────────────────────
# Cała sekcja opcjonalna. Pojedynczy pracownik może też mieć własną
# widoczność (np. lista jest "włączona", ale część osób ukryta).

class ProfileEmployee(Base):
    __tablename__ = "profile_employees"

    id         = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    profile_id = Column(TEXT, ForeignKey("cafe_profiles.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    full_name  = Column(String(150), nullable=False)
    role       = Column(String(100), nullable=False)
    bio        = Column(Text, nullable=True)
    visible    = Column(Boolean, nullable=False, default=True)
    position   = Column(Integer, nullable=False, default=0)

    profile = relationship("CafeProfile", back_populates="employees")