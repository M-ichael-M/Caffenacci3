import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.sqlite import TEXT

from app.core.database import Base


class Review(Base):
    __tablename__ = "reviews"

    id      = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    cafe_id = Column(TEXT, ForeignKey("cafes.id", ondelete="CASCADE"), nullable=False, index=True)

    # Widoczne dla właściciela (i w przyszłości publicznie)
    nick    = Column(String(60), nullable=False)
    rating  = Column(Integer, nullable=False)          # 1–5
    comment = Column(Text, nullable=True)

    # Identyfikator konta klienta — NIGDY nie jest zwracany w API.
    # System kont jeszcze nie istnieje, więc na razie zawsze NULL, ale
    # kolumna i unikalność są już gotowe na przyszłość. SQLite traktuje
    # każdy NULL jako odrębny w UNIQUE, więc wiele opinii bez client_id
    # nie koliduje ze sobą — ograniczenie zadziała dopiero gdy pole
    # zacznie być wypełniane.
    client_id = Column(TEXT, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("cafe_id", "client_id", name="uq_review_cafe_client"),
    )