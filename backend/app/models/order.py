import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, Float,
    ForeignKey, Enum as SAEnum,
)
from sqlalchemy.dialects.sqlite import TEXT
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class OrderStatus(str, enum.Enum):
    pending   = "pending"     # nowe, czeka na realizację
    completed = "completed"   # zrealizowane przez kawiarnię
    cancelled = "cancelled"   # anulowane (przez właściciela lub klienta)


# ── Ustawienia systemu zamówień ────────────────────────────────────────────

class OrderSettings(Base):
    """Jeden wiersz na kawiarnię – czy przyjmuje zamówienia online."""
    __tablename__ = "order_settings"

    id      = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    cafe_id = Column(TEXT, ForeignKey("cafes.id", ondelete="CASCADE"),
                      nullable=False, unique=True, index=True)
    enabled = Column(Boolean, nullable=False, default=False)


# ── Zamówienia ───────────────────────────────────────────────────────────

class Order(Base):
    __tablename__ = "orders"

    id      = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    cafe_id = Column(TEXT, ForeignKey("cafes.id", ondelete="CASCADE"),
                      nullable=False, index=True)

    # Klient — brak systemu kont. Nick jest widoczny właścicielowi,
    # client_id NIGDY nie jest zwracane w API (przygotowane na przyszłe konta,
    # służy tylko do autoryzacji anulowania przez klienta).
    client_nick = Column(String(60), nullable=False)
    client_id   = Column(TEXT, nullable=True)

    # Na kiedy zamówienie (max 3 dni do przodu — egzekwowane w routerze)
    date       = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    start_time = Column(String(5),  nullable=False)              # HH:MM

    # Wartość zamówienia — suma pozycji wg cennika w momencie złożenia.
    # W przyszłości rzeczywista zapłacona kwota może się różnić (punkty,
    # karta lojalnościowa) — na razie total_value = kwota "z cennika".
    total_value = Column(Float, nullable=False, default=0.0)

    status       = Column(SAEnum(OrderStatus), nullable=False, default=OrderStatus.pending)
    cancelled_by = Column(String(10), nullable=True)  # "owner" | "client"

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)

    items = relationship(
        "OrderItem", back_populates="order",
        cascade="all, delete-orphan", order_by="OrderItem.id",
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id       = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(TEXT, ForeignKey("orders.id", ondelete="CASCADE"),
                       nullable=False, index=True)

    # Poglądowa referencja do pozycji menu — bez twardego FK, bo menu
    # może się zmienić/zniknąć, a zamówienie ma zachować snapshot.
    menu_item_id = Column(TEXT, nullable=True)
    name         = Column(String(200), nullable=False)   # snapshot nazwy
    price        = Column(Float, nullable=False)         # snapshot ceny jednostkowej
    quantity     = Column(Integer, nullable=False, default=1)

    order = relationship("Order", back_populates="items")