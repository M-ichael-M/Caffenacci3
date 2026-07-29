import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.dialects.sqlite import TEXT

from app.core.database import Base


class CafeSite(Base):
    """Ustawienia wygenerowanej, publicznej strony kawiarni.

    Jeden wiersz na kawiarnię. Przechowuje wybór właściciela (szablon,
    paleta) oraz status publikacji. Publikacja jest krokiem całkowicie
    niezależnym od subskrypcji — opłacenie subskrypcji NIE publikuje
    strony automatycznie (patrz routers/site.py: /publish, /unpublish)."""

    __tablename__ = "cafe_sites"

    id      = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    cafe_id = Column(TEXT, ForeignKey("cafes.id", ondelete="CASCADE"),
                      nullable=False, unique=True, index=True)

    template = Column(String(20), nullable=False, default="classic")
    palette  = Column(String(40), nullable=False, default="espresso-gold")

    custom_palette_colors = Column(Text, nullable=True)

    # ── Publikacja ───────────────────────────────────────────────────────
    # Dopóki False: strona nie jest dostępna pod /site/public/*, nie
    # pojawia się w /cafes/search i (w przyszłości) nie jest indeksowana
    # przez Google. Podgląd właściciela (/site/preview/{cafe_id}) ignoruje
    # tę flagę celowo.
    is_published = Column(Boolean, nullable=False, default=False)
    published_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)