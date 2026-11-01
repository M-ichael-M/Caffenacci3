import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String
from app.core.types import ID

from app.core.database import Base


class CafeSlugHistory(Base):
    __tablename__ = "cafe_slug_history"

    id = Column(ID, primary_key=True, default=lambda: str(uuid.uuid4()))
    cafe_id = Column(
        ID, ForeignKey("cafes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    slug = Column(String(160), nullable=False, unique=True, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)