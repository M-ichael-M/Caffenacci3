from __future__ import annotations
from pydantic import BaseModel

# ── Stałe ──────────────────────────────────────────────────────────────────

MAX_GALLERY_IMAGES            = 10
MAX_GALLERY_IMAGE_BYTES       = 10 * 1024 * 1024  # 10 MB na zdjęcie
ALLOWED_GALLERY_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}

# Zdjęcia są po stronie serwera przeskalowywane i zapisywane jako
# skompresowany JPEG — oszczędza to miejsce na dysku i przyspiesza
# ładowanie strony kawiarni bez zauważalnej utraty jakości.
GALLERY_MAX_DIMENSION = 1920
GALLERY_JPEG_QUALITY  = 82


class GalleryImageOut(BaseModel):
    id:       str
    url:      str
    position: int
    model_config = {"from_attributes": True}


class PublicGalleryImageOut(BaseModel):
    url: str