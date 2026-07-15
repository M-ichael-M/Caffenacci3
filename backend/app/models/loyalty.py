import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, ForeignKey, Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.sqlite import TEXT
from sqlalchemy.orm import relationship

from app.core.database import Base


class LoyaltySettings(Base):
    """Ustawienia programu lojalnościowego danej kawiarni — jeden wiersz na
    kawiarnię. Kawiarnia wybiera dokładnie jeden tryb: 'points' (punkty za
    zakupy) albo 'stamps' (pieczątki cyfrowe)."""

    __tablename__ = "loyalty_settings"

    id      = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    cafe_id = Column(TEXT, ForeignKey("cafes.id", ondelete="CASCADE"),
                      nullable=False, unique=True, index=True)

    enabled = Column(Boolean, nullable=False, default=False)
    mode    = Column(String(20), nullable=False, default="points")  # points | stamps

    # ── Pieczątki cyfrowe ──────────────────────────────────────────────
    stamps_max         = Column(Integer, nullable=False, default=10)
    stamps_earn_desc   = Column(Text, nullable=True)   # za co przyznawana jest pieczątka
    stamps_reward_desc = Column(Text, nullable=True)   # co się dostaje po zebraniu maksimum

    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)

    rewards = relationship(
        "LoyaltyReward",
        back_populates="settings",
        cascade="all, delete-orphan",
        order_by="LoyaltyReward.position",
    )


class LoyaltyReward(Base):
    """Nagroda do wymiany za punkty (wyłącznie tryb 'points')."""

    __tablename__ = "loyalty_rewards"

    id          = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    settings_id = Column(TEXT, ForeignKey("loyalty_settings.id", ondelete="CASCADE"),
                          nullable=False, index=True)
    name        = Column(String(200), nullable=False)
    cost_points = Column(Integer, nullable=False)
    position    = Column(Integer, nullable=False, default=0)

    settings = relationship("LoyaltySettings", back_populates="rewards")


class ClientLoyalty(Base):
    """Stan konta lojalnościowego jednego klienta w jednej, konkretnej
    kawiarni. Systemy poszczególnych kawiarni są od siebie całkowicie
    niezależne — ten sam klient ma osobne saldo w każdej z nich."""

    __tablename__ = "client_loyalty"

    id        = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    cafe_id   = Column(TEXT, ForeignKey("cafes.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    client_id = Column(TEXT, ForeignKey("clients.id", ondelete="CASCADE"),
                        nullable=False, index=True)

    points = Column(Integer, nullable=False, default=0)
    stamps = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("cafe_id", "client_id", name="uq_client_loyalty_cafe_client"),
    )


class LoyaltyTransaction(Base):
    """Historia operacji przy kasie — audyt doliczeń, wymian, pieczątek
    i zerowania karty."""

    __tablename__ = "loyalty_transactions"

    id        = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    cafe_id   = Column(TEXT, ForeignKey("cafes.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    client_id = Column(TEXT, ForeignKey("clients.id", ondelete="CASCADE"),
                        nullable=False, index=True)

    # earn_points | redeem_points | add_stamp | reset_stamps
    kind         = Column(String(20), nullable=False)
    description  = Column(String(255), nullable=True)
    points_delta = Column(Integer, nullable=False, default=0)
    stamps_delta = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)