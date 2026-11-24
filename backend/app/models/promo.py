import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint,
)

from app.core.database import Base
from app.core.types import ID


class PromoCode(Base):
    """Kod promocyjny: darmowy dostęp na `days` dni. Limit użyć i data ważności są opcjonalne
    (NULL = bez limitu). `uses_count` zwiększany atomowo przy realizacji."""
    __tablename__ = "promo_codes"
    __table_args__ = (
        CheckConstraint("days > 0", name="ck_promo_days_positive"),
        CheckConstraint("max_uses IS NULL OR max_uses > 0", name="ck_promo_max_uses_positive"),
    )

    id         = Column(ID, primary_key=True, default=lambda: str(uuid.uuid4()))
    code       = Column(String(50), nullable=False, unique=True, index=True)  # zawsze WIELKIMI literami
    days       = Column(Integer, nullable=False)
    max_uses   = Column(Integer, nullable=True)
    uses_count = Column(Integer, nullable=False, default=0, server_default="0")
    expires_at = Column(DateTime, nullable=True)
    is_active  = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class PromoRedemption(Base):
    """Kto i kiedy użył kodu. Unikalność (cafe_id, promo_id) = kawiarnia może użyć danego kodu tylko raz,
    nawet po wygaśnięciu dostępu."""
    __tablename__ = "promo_redemptions"
    __table_args__ = (
        UniqueConstraint("cafe_id", "promo_id", name="uq_promo_redemption_cafe_promo"),
    )

    id          = Column(ID, primary_key=True, default=lambda: str(uuid.uuid4()))
    promo_id    = Column(ID, ForeignKey("promo_codes.id", ondelete="CASCADE"), nullable=False, index=True)
    cafe_id     = Column(ID, ForeignKey("cafes.id", ondelete="CASCADE"), nullable=False, index=True)
    redeemed_at = Column(DateTime, nullable=False, default=datetime.utcnow)