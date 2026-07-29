import uuid
from datetime import datetime

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.sqlite import TEXT

from app.core.database import Base


class Subscription(Base):
    """Symulowana subskrypcja kawiarni — bez prawdziwych płatności (Stripe
    zostanie podpięty później). Jeden wiersz na kawiarnię.

    `kind`:
      - "subscription" — płatna subskrypcja (symulowana), odnawia się co 30 dni
      - "promo"        — darmowy kod promocyjny, wygasa i NIE odnawia się

    Celowo brak osobnego pola "status" — efektywny stan (aktywna / kończy
    się / wygasła) jest wyliczany w locie w routers/billing.py na podstawie
    dat, żeby uniknąć rozjazdu między zapisanym stanem a upływem czasu
    (nie ma tu cron-a ani background jobów — zgodnie z resztą projektu)."""

    __tablename__ = "subscriptions"

    id      = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    cafe_id = Column(TEXT, ForeignKey("cafes.id", ondelete="CASCADE"),
                      nullable=False, unique=True, index=True)

    kind       = Column(String(20), nullable=False)   # subscription | promo
    promo_code = Column(String(50), nullable=True)

    period_start = Column(DateTime, nullable=False)
    period_end   = Column(DateTime, nullable=False)

    # Tylko dla kind="subscription" — właściciel anulował, ale opłacony
    # okres biegnie dalej do period_end.
    cancel_at_period_end = Column(Boolean, nullable=False, default=False)
    cancelled_at          = Column(DateTime, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)