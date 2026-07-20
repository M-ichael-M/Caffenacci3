import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.sqlite import TEXT

from app.core.database import Base


class CafeSite(Base):
    """Ustawienia wygenerowanej, publicznej strony kawiarni.

    Jeden wiersz na kawiarnię. Przechowuje tylko wybór właściciela —
    szablon (klasyczny / nowoczesny) i paletę kolorów. Wszystkie
    pozostałe dane wyświetlane na stronie (profil, menu, rezerwacje,
    zamówienia, opinie) pochodzą z istniejących już tabel — strona jest
    składana "na żywo" z tego, co właściciel skonfigurował i włączył
    w pozostałych częściach panelu."""

    __tablename__ = "cafe_sites"

    id      = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    cafe_id = Column(TEXT, ForeignKey("cafes.id", ondelete="CASCADE"),
                      nullable=False, unique=True, index=True)

    template = Column(String(20), nullable=False, default="classic")   # classic | modern
    palette  = Column(String(40), nullable=False, default="espresso-gold")

    # Niestandardowa paleta wygenerowana z logo kawiarni — używana tylko
    # gdy palette == "custom". Trzymana jako zserializowany JSON (mapa
    # nazw zmiennych CSS na wartości hex) — zestaw kluczy jest stały
    # (patrz CUSTOM_PALETTE_VAR_KEYS w schemas/site.py), więc osobna
    # tabela byłaby przerostem formy nad treścią.
    custom_palette_colors = Column(Text, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)