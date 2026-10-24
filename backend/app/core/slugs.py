from __future__ import annotations

import re
import unicodedata
import uuid

from sqlalchemy.orm import Session

MAX_SLUG_LEN = 80
FALLBACK = "lokal"

# Slugi, które nigdy nie mogą zostać nadane kawiarni (kolizje z trasami / plikami).
RESERVED_SLUGS = frozenset({
    "api", "admin", "kawiarnia", "kawiarnie", "cafe", "cafes", "konto", "preview",
    "assets", "static", "uploads", "sitemap", "robots", "favicon", "docs", "redoc",
    "openapi", "health", "auth", "me", "profile", "site", "billing", "client-auth",
    "employee-auth", "menu", "order", "orders", "review", "reviews", "loyalty",
    "reservation", "reservations", "news", "login", "register", "logout", "panel",
    "www", "app", "null", "undefined",
})

# NFKD nie rozkłada ł/Ł (i kilku innych) — mapujemy jawnie.
_TRANSLIT = str.maketrans({
    "ł": "l", "Ł": "l", "ø": "o", "Ø": "o", "đ": "d", "Đ": "d",
    "ß": "ss", "æ": "ae", "Æ": "ae", "œ": "oe", "Œ": "oe",
})


def _truncate(slug: str, max_len: int) -> str:
    """Ucina na granicy słowa (myślnika), jeśli się da."""
    if len(slug) <= max_len:
        return slug
    cut = slug[:max_len]
    if slug[max_len] != "-" and "-" in cut:
        cut = cut.rsplit("-", 1)[0]
    return cut.strip("-")


def slugify(text: str, max_len: int = MAX_SLUG_LEN) -> str:
    """'Pod Lipą — Łódź' -> 'pod-lipa-lodz'. Tylko [a-z0-9-], bez podwójnych
    myślników, max `max_len` znaków (ucinane na granicy słowa)."""
    text = (text or "").translate(_TRANSLIT)
    normalized = unicodedata.normalize("NFKD", text)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_only).strip("-")
    return _truncate(slug, max_len)


def build_cafe_slug(cafe_name: str, city: str) -> str:
    """'Pod Lipą' + 'Warszawa' -> 'pod-lipa-warszawa'.
    Jeśli nazwa już zawiera miasto ('Warszawa Coffee'), nie dubluje go."""
    name_slug = slugify(cafe_name)
    city_slug = slugify(city)

    if not city_slug:
        return name_slug or FALLBACK
    if not name_slug:
        return f"{FALLBACK}-{city_slug}"
    if f"-{city_slug}-" in f"-{name_slug}-":
        return name_slug

    room = MAX_SLUG_LEN - len(city_slug) - 1
    if room < 10:  # absurdalnie długie miasto
        return slugify(f"{name_slug}-{city_slug}")
    return f"{_truncate(name_slug, room)}-{city_slug}"


def _is_taken(slug: str, db: Session, exclude_cafe_id: str | None) -> bool:
    from app.models.cafe import Cafe
    from app.models.slug_history import CafeSlugHistory

    if slug in RESERVED_SLUGS:
        return True

    q = db.query(Cafe.id).filter(Cafe.slug == slug)
    if exclude_cafe_id:
        q = q.filter(Cafe.id != exclude_cafe_id)
    if q.first():
        return True

    # Stary slug innej kawiarni jest "zajęty" na zawsze — inaczej stary link
    # zacząłby prowadzić do obcej kawiarni. Własna historia kawiarni nie blokuje.
    h = db.query(CafeSlugHistory.id).filter(CafeSlugHistory.slug == slug)
    if exclude_cafe_id:
        h = h.filter(CafeSlugHistory.cafe_id != exclude_cafe_id)
    return h.first() is not None


def generate_unique_slug(
    cafe_name: str,
    city: str,
    db: Session,
    exclude_cafe_id: str | None = None,
) -> str:
    """Unikalny slug nazwa-miasto; przy kolizji sufiks -2, -3, ..."""
    base = build_cafe_slug(cafe_name, city)
    if not _is_taken(base, db, exclude_cafe_id):
        return base

    for n in range(2, 1000):
        suffix = f"-{n}"
        candidate = _truncate(base, MAX_SLUG_LEN - len(suffix)) + suffix
        if not _is_taken(candidate, db, exclude_cafe_id):
            return candidate

    # Skrajny przypadek — praktycznie nieosiągalny
    return f"{_truncate(base, MAX_SLUG_LEN - 9)}-{uuid.uuid4().hex[:8]}"


def apply_slug_change(cafe, db: Session) -> bool:
    """Przelicza slug z aktualnych cafe_name/city. Jeśli się zmienił: stary
    trafia do historii, nowy do cafes.slug. NIE commituje — robi to wołający
    (dzięki temu zmiana jest w jednej transakcji z resztą zapisu)."""
    from app.models.slug_history import CafeSlugHistory

    new_slug = generate_unique_slug(cafe.cafe_name, cafe.city, db, exclude_cafe_id=cafe.id)
    old_slug = cafe.slug
    if new_slug == old_slug:
        return False

    if old_slug and not db.query(CafeSlugHistory.id).filter(CafeSlugHistory.slug == old_slug).first():
        db.add(CafeSlugHistory(cafe_id=cafe.id, slug=old_slug))

    # Powrót do dawnej nazwy: nowy slug nie może jednocześnie wisieć w historii.
    db.query(CafeSlugHistory).filter(
        CafeSlugHistory.slug == new_slug,
        CafeSlugHistory.cafe_id == cafe.id,
    ).delete(synchronize_session=False)

    cafe.slug = new_slug
    return True


def resolve_slug(slug: str, db: Session):
    """Zwraca (cafe, is_current). is_current=False => slug z historii (-> 301)."""
    from app.models.cafe import Cafe
    from app.models.slug_history import CafeSlugHistory

    cafe = db.query(Cafe).filter(Cafe.slug == slug).first()
    if cafe:
        return cafe, True

    row = db.query(CafeSlugHistory).filter(CafeSlugHistory.slug == slug).first()
    if row:
        cafe = db.query(Cafe).filter(Cafe.id == row.cafe_id).first()
        if cafe:
            return cafe, False
    return None, False