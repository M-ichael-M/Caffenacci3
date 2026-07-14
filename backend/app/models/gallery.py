import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.sqlite import TEXT

from app.core.database import Base


class CafeGalleryImage(Base):
    """Pojedyncze zdjęcie w galerii kawiarni.

    Maksymalnie 10 na kawiarnię — egzekwowane w warstwie API
    (routers/cafe_profile.py), nie w bazie, żeby nie sztywnić schematu.
    """

    __tablename__ = "cafe_gallery_images"

    id      = Column(TEXT, primary_key=True, default=lambda: str(uuid.uuid4()))
    cafe_id = Column(TEXT, ForeignKey("cafes.id", ondelete="CASCADE"),
                      nullable=False, index=True)

    # Ścieżka względna w /uploads/gallery — plik jest już przeskalowany
    # i skompresowany w momencie zapisu (patrz routers/cafe_profile.py).
    image_path = Column(String(500), nullable=False)
    position   = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)