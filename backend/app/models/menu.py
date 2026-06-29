import uuid

from sqlalchemy import Column, String, Float, Boolean, Integer, ForeignKey, Text
from sqlalchemy.dialects.sqlite import TEXT
from sqlalchemy.orm import relationship

from app.core.database import Base


class MenuSection(Base):
    __tablename__ = "menu_sections"

    id = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    cafe_id = Column(TEXT, ForeignKey("cafes.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    position = Column(Integer, nullable=False, default=0)

    items = relationship(
        "MenuItem",
        back_populates="section",
        cascade="all, delete-orphan",
        order_by="MenuItem.position",
    )


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    section_id = Column(TEXT, ForeignKey("menu_sections.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)
    position = Column(Integer, nullable=False, default=0)

    # Znaczniki
    is_vege = Column(Boolean, nullable=False, default=False)
    is_hot = Column(Boolean, nullable=False, default=False)
    is_unavailable = Column(Boolean, nullable=False, default=False)

    section = relationship("MenuSection", back_populates="items")