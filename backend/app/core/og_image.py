"""Obraz 1200×630 do podglądów społecznościowych (og:image / twitter:image)."""
from __future__ import annotations

import hashlib
import io

from fastapi import Request
from fastapi.responses import FileResponse, Response
from PIL import Image, ImageDraw, ImageOps
from sqlalchemy.orm import Session

from app.core.images import (
    CC_IMMUTABLE, CC_SHORT, GALLERY_TIERS, LOGO_TIERS,
    _etag, _etag_matches, resolve_file,
)
from app.core.storage import get_storage
from app.models.cafe_profile import CafeProfile
from app.models.gallery import CafeGalleryImage

OG_W, OG_H = 1200, 630
_BG = (247, 244, 238)


def _open(directory: str, base: str, w: int, tiers) -> Image.Image | None:
    path = resolve_file(directory, base, w, tiers)
    if not path:
        return None
    with Image.open(path) as im:
        im.load()
        return im.copy()


def _render(gallery_base: str | None, logo_base: str | None) -> bytes | None:
    canvas: Image.Image | None = None
    if gallery_base:
        photo = _open("gallery", gallery_base, 1600, GALLERY_TIERS)
        if photo is not None:
            canvas = ImageOps.fit(
                photo.convert("RGB"), (OG_W, OG_H), Image.Resampling.LANCZOS,
                centering=(0.5, 0.4),
            )
    logo = None
    if logo_base:
        raw = _open("logos", logo_base, 512, LOGO_TIERS)
        logo = raw.convert("RGBA") if raw is not None else None

    if canvas is None:
        if logo is None:
            return None
        canvas = Image.new("RGB", (OG_W, OG_H), _BG)
        big = logo.copy()
        big.thumbnail((380, 380), Image.Resampling.LANCZOS)
        canvas.paste(big, ((OG_W - big.width) // 2, (OG_H - big.height) // 2), big)
    elif logo is not None:
        size, ring = 140, 156
        x, y = 40, OG_H - 40 - ring
        ImageDraw.Draw(canvas).ellipse((x, y, x + ring, y + ring), fill=(255, 255, 255))
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
        small = logo.resize((size, size), Image.Resampling.LANCZOS)
        flat = Image.new("RGB", (size, size), (255, 255, 255))
        flat.paste(small, mask=small.split()[-1])
        canvas.paste(flat, (x + (ring - size) // 2, y + (ring - size) // 2), mask)

    buf = io.BytesIO()
    canvas.save(buf, "JPEG", quality=84, optimize=True, progressive=True)
    return buf.getvalue()


def ensure_og_image(cafe_id: str, db: Session) -> str | None:
    """Ścieżka lokalna wygenerowanego pliku albo None (brak zdjęcia i logo)."""
    profile = db.query(CafeProfile).filter(CafeProfile.cafe_id == cafe_id).first()
    if not profile:
        return None
    gallery_base = None
    if profile.gallery_visible:
        row = (db.query(CafeGalleryImage).filter(CafeGalleryImage.cafe_id == cafe_id)
               .order_by(CafeGalleryImage.position).first())
        gallery_base = row.image_path if row else None
    logo_base = profile.logo_path
    if not (gallery_base or logo_base):
        return None

    sig = hashlib.sha1(f"{gallery_base}|{logo_base}".encode()).hexdigest()[:12]
    key = f"og/{cafe_id}_{sig}.jpg"
    storage = get_storage()
    if not storage.exists(key):
        data = _render(gallery_base, logo_base)
        if data is None:
            return None
        storage.delete_prefix(f"og/{cafe_id}_")
        storage.put(key, data, "image/jpeg")
    return str(storage.local_path(key))


def og_file_response(request: Request, path: str) -> Response:
    etag = _etag(path)
    headers = {
        "ETag": etag,
        "Cache-Control": CC_IMMUTABLE if "v" in request.query_params else CC_SHORT,
    }
    if _etag_matches(request.headers.get("if-none-match"), etag):
        return Response(status_code=304, headers=headers)
    return FileResponse(path, media_type="image/jpeg", headers=headers)
