from __future__ import annotations
from typing import Optional
from pydantic import BaseModel

MAX_GALLERY_IMAGES            = 10
MAX_GALLERY_IMAGE_BYTES       = 10 * 1024 * 1024  # 10 MB na zdjęcie
ALLOWED_GALLERY_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}
# Warianty WebP (480/960/1600) → app/core/images.py


class GalleryImageOut(BaseModel):
    id:       str
    url:      str
    position: int
    width:    Optional[int] = None
    height:   Optional[int] = None
    model_config = {"from_attributes": True}


class PublicGalleryImageOut(BaseModel):
    url:    str
    width:  Optional[int] = None
    height: Optional[int] = None