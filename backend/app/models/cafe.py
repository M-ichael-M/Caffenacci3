import uuid

from sqlalchemy import Column, String
from sqlalchemy.dialects.sqlite import TEXT

from app.core.database import Base


class Cafe(Base):
    __tablename__ = "cafes"

    id = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Właściciel
    owner_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    phone = Column(String(30), nullable=False)

    # Kawiarnia
    cafe_name = Column(String(150), nullable=False)

    # Adres
    country = Column(String(100), nullable=False)
    city = Column(String(100), nullable=False)
    street = Column(String(150), nullable=False)
    building_number = Column(String(20), nullable=False)
    postal_code = Column(String(20), nullable=False)
