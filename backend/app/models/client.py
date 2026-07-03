import uuid
from datetime import datetime

from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.sqlite import TEXT

from app.core.database import Base


class Client(Base):
    """Konto użytkownika (gościa kawiarni) — osobne od konta właściciela (Cafe).

    `id` tego modelu jest wartością zapisywaną w polach `client_id`,
    które zostały wcześniej przygotowane w rezerwacjach, opiniach
    i zamówieniach (dotąd zawsze puste — od teraz mogą być wypełniane
    przez zalogowanych użytkowników)."""

    __tablename__ = "clients"

    id = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))

    full_name = Column(String(150), nullable=False)
    nick      = Column(String(40), nullable=False, unique=True, index=True)
    email     = Column(String(255), nullable=False, unique=True, index=True)
    phone     = Column(String(30), nullable=True)

    password_hash = Column(String(255), nullable=False)

    accepted_terms   = Column(Boolean, nullable=False, default=False)
    accepted_privacy = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)