import uuid
from datetime import datetime

from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.dialects.sqlite import TEXT

from app.core.database import Base


class NewsSettings(Base):
    """Jeden wiersz na kawiarnię — globalny przełącznik widoczności sekcji
    aktualności na publicznej stronie."""
    __tablename__ = "news_settings"

    id      = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    cafe_id = Column(TEXT, ForeignKey("cafes.id", ondelete="CASCADE"),
                      nullable=False, unique=True, index=True)
    enabled = Column(Boolean, nullable=False, default=False)


class NewsPost(Base):
    """Pojedyncza aktualność. Maksymalnie 3 na kawiarnię jednocześnie —
    egzekwowane w warstwie API (routers/news.py), analogicznie do limitu
    zdjęć w galerii."""
    __tablename__ = "news_posts"

    id      = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    cafe_id = Column(TEXT, ForeignKey("cafes.id", ondelete="CASCADE"),
                      nullable=False, index=True)

    title   = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)

    # Ścieżka względna w /uploads/news — opcjonalna grafika, przeskalowana
    # i skompresowana w momencie zapisu (patrz routers/news.py).
    image_path = Column(String(500), nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)