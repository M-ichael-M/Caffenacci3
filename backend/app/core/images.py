"""Wspólna obsługa obrazów: warianty WebP, wersjonowane URL-e, serwowanie z cache."""
from __future__ import annotations

import glob
import hashlib
import io
import mimetypes
import os
from dataclasses import dataclass

from fastapi import HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, Response
from PIL import Image, ImageOps

GALLERY_TIERS: tuple[int, ...] = (480, 960, 1600)   # galeria + aktualności
LOGO_TIERS:    tuple[int, ...] = (128, 256, 512)

WEBP_QUALITY = 80
WEBP_METHOD  = 4
MAX_PIXELS   = 50_000_000          # ochrona przed "decompression bomb"

CC_IMMUTABLE = "public, max-age=31536000, immutable"
CC_SHORT     = "public, max-age=300"   # gdy URL nie niesie ?v= (np. stary HTML z cache)


@dataclass(frozen=True)
class SavedImage:
    base_name: str
    width:     int        # wymiary największego wariantu → width/height w API
    height:    int
    variants:  list[int]  # zapisane kafelki (tiers)


# ── Ścieżki i URL-e ──────────────────────────────────────────────────────────

def is_variant_base(image_path: str) -> bool:
    """Nowy format: nazwa bazowa bez rozszerzenia. Stary: 'xxx.jpg'."""
    return os.path.splitext(image_path)[1] == ""


def version_of(image_path: str) -> str:
    return hashlib.sha1(image_path.encode()).hexdigest()[:8]


def _versioned(url_path: str, image_path: str | None) -> str | None:
    return f"{url_path}?v={version_of(image_path)}" if image_path else None


def logo_url(cafe_id: str, logo_path: str | None) -> str | None:
    return _versioned(f"/profile/logo/{cafe_id}", logo_path)


def gallery_url(cafe_id: str, image_id: str, image_path: str | None) -> str | None:
    return _versioned(f"/profile/gallery/{cafe_id}/{image_id}", image_path)


def news_image_url(cafe_id: str, post_id: str, image_path: str | None) -> str | None:
    return _versioned(f"/news/image/{cafe_id}/{post_id}", image_path)


# ── Zapis wariantów ──────────────────────────────────────────────────────────

def _decode(raw: bytes, keep_alpha: bool) -> Image.Image:
    try:
        Image.open(io.BytesIO(raw)).verify()
        img = Image.open(io.BytesIO(raw))
        if img.width * img.height > MAX_PIXELS:
            raise ValueError("too large")
        img.load()
    except Exception:
        raise HTTPException(400, detail="Plik nie jest prawidłowym obrazem.")

    img = ImageOps.exif_transpose(img)
    has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
    if has_alpha:
        img = img.convert("RGBA")
        if not keep_alpha:                       # jak dotąd: spłaszcz na biało
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[-1])
            img = bg
    else:
        img = img.convert("RGB")
    return img


def _plan(orig_w: int, tiers: tuple[int, ...]) -> list[tuple[int, int]]:
    """[(kafelek, szerokość_docelowa)] — bez powiększania; patrz decyzja nr 2."""
    smaller = [t for t in tiers if t <= orig_w]
    out = [(t, t) for t in smaller]
    if not smaller or smaller[-1] != orig_w:
        bigger = [t for t in tiers if t > orig_w]
        if bigger:
            out.append((bigger[0], orig_w))
    return out


def save_image_variants(
    raw: bytes, base_name: str, directory: str, tiers: tuple[int, ...],
    *, keep_alpha: bool = False,
) -> SavedImage:
    """CPU-bound — z endpointów wołaj save_image_variants_async."""
    img = _decode(raw, keep_alpha)
    img.thumbnail((tiers[-1], tiers[-1]), Image.Resampling.LANCZOS)
    plan = _plan(img.width, tiers)

    written: list[str] = []
    try:
        for tier, target_w in plan:
            v = img if target_w == img.width else img.resize(
                (target_w, max(1, round(img.height * target_w / img.width))),
                Image.Resampling.LANCZOS,
            )
            path = os.path.join(directory, f"{base_name}_{tier}.webp")
            v.save(path, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)
            written.append(path)
    except Exception:
        for p in written:
            try: os.remove(p)
            except OSError: pass
        raise HTTPException(500, detail="Nie udało się zapisać obrazu.")

    return SavedImage(base_name, img.width, img.height, [t for t, _ in plan])


async def save_image_variants_async(*args, **kwargs) -> SavedImage:
    return await run_in_threadpool(save_image_variants, *args, **kwargs)


def delete_image_files(directory: str, image_path: str | None) -> None:
    if not image_path:
        return
    if is_variant_base(image_path):
        pattern = os.path.join(directory, f"{glob.escape(image_path)}_*.webp")
        files = glob.glob(pattern)
    else:
        files = [os.path.join(directory, image_path)]
    for f in files:
        try: os.remove(f)
        except OSError: pass


# ── Serwowanie ───────────────────────────────────────────────────────────────

def normalise_width(w: int | None, tiers: tuple[int, ...]) -> int:
    """Brak w → największy; wartość spoza zbioru → najbliższy mniejszy (min. najmniejszy)."""
    if w is None:
        return tiers[-1]
    ok = [t for t in tiers if t <= w]
    return ok[-1] if ok else tiers[0]


def resolve_file(directory: str, image_path: str, w: int | None, tiers: tuple[int, ...]) -> str | None:
    if not is_variant_base(image_path):                       # fallback: stary plik
        p = os.path.join(directory, image_path)
        return p if os.path.isfile(p) else None
    target = normalise_width(w, tiers)
    for t in sorted((t for t in tiers if t <= target), reverse=True):
        p = os.path.join(directory, f"{image_path}_{t}.webp")
        if os.path.isfile(p):
            return p
    return None


def _etag(path: str) -> str:
    st = os.stat(path)
    key = f"{os.path.basename(path)}:{st.st_size}:{st.st_mtime_ns}"
    return '"' + hashlib.sha1(key.encode()).hexdigest()[:24] + '"'


def _etag_matches(header: str | None, etag: str) -> bool:
    if not header:
        return False
    if header.strip() == "*":
        return True
    return any(t.strip().removeprefix("W/") == etag for t in header.split(","))


def image_response(request: Request, directory: str, image_path: str,
                   w: int | None, tiers: tuple[int, ...]) -> Response:
    path = resolve_file(directory, image_path, w, tiers)
    if path is None:
        raise HTTPException(404, detail="Plik grafiki nie istnieje.")
    etag = _etag(path)
    headers = {
        "ETag": etag,
        # immutable tylko gdy URL niesie wersję (?v=) — inaczej krótki cache
        "Cache-Control": CC_IMMUTABLE if "v" in request.query_params else CC_SHORT,
    }
    if _etag_matches(request.headers.get("if-none-match"), etag):
        return Response(status_code=304, headers=headers)
    media = "image/webp" if path.endswith(".webp") else (mimetypes.guess_type(path)[0] or "application/octet-stream")
    return FileResponse(path, media_type=media, headers=headers)