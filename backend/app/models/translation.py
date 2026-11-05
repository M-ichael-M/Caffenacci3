import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint,
)

from app.core.database import Base
from app.core.types import ID


class CafeLanguageSettings(Base):
    """Języki strony kawiarni — jeden wiersz na kawiarnię. Brak wiersza = domyślnie
    język podstawowy 'pl' i brak języka dodatkowego."""
    __tablename__ = "cafe_language_settings"

    id      = Column(ID, primary_key=True, default=lambda: str(uuid.uuid4()))
    cafe_id = Column(ID, ForeignKey("cafes.id", ondelete="CASCADE"),
                     nullable=False, unique=True, index=True)

    primary_language   = Column(String(8), nullable=False, default="pl")
    secondary_language = Column(String(8), nullable=True)

    # Przygotowanie pod formatowanie: waluta cen z menu i strefa czasowa kawiarni.
    currency  = Column(String(3), nullable=False, default="PLN")
    time_zone = Column(String(64), nullable=False, default="Europe/Warsaw")

    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)


class TranslationPackage(Base):
    """Jedna wygenerowana paczka (plik do tłumaczenia). Trzyma migawkę tekstów,
    żeby wgrany plik dało się zweryfikować niezależnie od późniejszych zmian."""
    __tablename__ = "translation_packages"
    __table_args__ = (
        UniqueConstraint("cafe_id", "target_language", "version", name="uq_translation_package_version"),
    )

    id      = Column(ID, primary_key=True, default=lambda: str(uuid.uuid4()))
    cafe_id = Column(ID, ForeignKey("cafes.id", ondelete="CASCADE"), nullable=False, index=True)

    source_language = Column(String(8), nullable=False)
    target_language = Column(String(8), nullable=False)

    version = Column(Integer, nullable=False)                 # v1, v2, ... (per kawiarnia + język)
    token   = Column(BigInteger, nullable=False, unique=True, index=True)  # 12 cyfr, w pliku
    source_hash = Column(String(64), nullable=False)
    texts   = Column(Text, nullable=False)                    # JSON: lista tekstów (indeks+1 = znacznik)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class CafeTranslation(Base):
    """Wgrane tłumaczenie — jedno na (kawiarnia, język docelowy)."""
    __tablename__ = "cafe_translations"
    __table_args__ = (
        UniqueConstraint("cafe_id", "target_language", name="uq_cafe_translation_language"),
    )

    id      = Column(ID, primary_key=True, default=lambda: str(uuid.uuid4()))
    cafe_id = Column(ID, ForeignKey("cafes.id", ondelete="CASCADE"), nullable=False, index=True)

    source_language = Column(String(8), nullable=False)
    target_language = Column(String(8), nullable=False)

    package_id      = Column(ID, ForeignKey("translation_packages.id", ondelete="SET NULL"), nullable=True)
    package_version = Column(Integer, nullable=False)
    source_hash     = Column(String(64), nullable=False)
    entries         = Column(Text, nullable=False)            # JSON: {tekst źródłowy: tłumaczenie}

    uploaded_at = Column(DateTime, nullable=False, default=datetime.utcnow)