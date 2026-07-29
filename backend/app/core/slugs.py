from __future__ import annotations
import re
import unicodedata
import uuid
from sqlalchemy.orm import Session


def slugify(text: str) -> str:
    """Zamienia nazwę kawiarni na fragment adresu URL: małe litery,
    bez polskich znaków/znaków specjalnych, spacje -> podkreślenia."""
    normalized = unicodedata.normalize("NFKD", text)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    lowered = ascii_only.lower()
    slug = re.sub(r"[^a-z0-9]+", "_", lowered)
    slug = re.sub(r"_+", "_", slug).strip("_")
    return slug or "kawiarnia"


def generate_unique_slug(cafe_name: str, db: Session, exclude_cafe_id: str | None = None) -> str:
    """Generuje unikalny slug na podstawie nazwy kawiarni. W razie kolizji
    dokleja krótki losowy sufiks (np. luna_cafe_a82x)."""
    from app.models.cafe import Cafe  # import lokalny — unika cyklicznych importów

    base = slugify(cafe_name)
    candidate = base

    for _ in range(25):
        query = db.query(Cafe).filter(Cafe.slug == candidate)
        if exclude_cafe_id:
            query = query.filter(Cafe.id != exclude_cafe_id)
        if not query.first():
            return candidate
        candidate = f"{base}_{uuid.uuid4().hex[:4]}"

    # Skrajny przypadek (bardzo mało prawdopodobny) — dłuższy losowy sufiks
    return f"{base}_{uuid.uuid4().hex[:8]}"