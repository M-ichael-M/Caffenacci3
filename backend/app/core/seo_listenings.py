"""Indeks opublikowanych kawiarni dla stron SEO (miasta, plakietki, strona główna, sitemap).
Jeden współdzielony odczyt z krótkim TTL — crawler nie powinien wyzwalać zapytań na każdy URL."""
from __future__ import annotations

import threading
import time
from collections import Counter
from dataclasses import dataclass

from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.core.slugs import slugify
from app.models.cafe import Cafe
from app.models.cafe_profile import CafeProfile
from app.models.review import Review
from app.models.site import CafeSite

# Progi "cienkiej treści": poniżej tego strona nie istnieje (404) i nie trafia do sitemapy.
MIN_CITY_CAFES = 1
MIN_BADGE_CAFES = 2

_TTL = 60.0
_lock = threading.Lock()
_cache: dict = {"at": 0.0, "rows": None}


@dataclass(frozen=True)
class IdxCafe:
    id: str
    slug: str
    name: str
    city: str
    city_slug: str
    country: str
    street: str
    building_number: str
    postal_code: str
    rating: float | None
    reviews: int
    badges: frozenset


@dataclass(frozen=True)
class City:
    slug: str
    name: str
    country: str
    count: int


def load_cafes(db: Session) -> list[IdxCafe]:
    now = time.monotonic()
    with _lock:
        if _cache["rows"] is not None and now - _cache["at"] < _TTL:
            return _cache["rows"]

    rating_sq = (
        db.query(
            Review.cafe_id.label("cafe_id"),
            func.avg(Review.rating).label("avg"),
            func.count(Review.id).label("cnt"),
        )
        .group_by(Review.cafe_id)
        .subquery()
    )
    rows = (
        db.query(Cafe, rating_sq.c.avg, rating_sq.c.cnt)
        .join(CafeSite, CafeSite.cafe_id == Cafe.id)
        .outerjoin(rating_sq, rating_sq.c.cafe_id == Cafe.id)
        .filter(CafeSite.is_published.is_(True), Cafe.slug.isnot(None))
        .order_by(Cafe.cafe_name)
        .all()
    )
    ids = [c.id for c, _, _ in rows]
    badges: dict[str, frozenset] = {}
    if ids:
        for p in (
            db.query(CafeProfile)
            .options(selectinload(CafeProfile.badges))
            .filter(CafeProfile.cafe_id.in_(ids))
            .all()
        ):
            badges[p.cafe_id] = frozenset(b.key for b in p.badges)

    out: list[IdxCafe] = []
    for c, avg, cnt in rows:
        city_slug = slugify(c.city)
        if not city_slug:
            continue
        out.append(IdxCafe(
            id=c.id, slug=c.slug, name=c.cafe_name, city=c.city, city_slug=city_slug,
            country=c.country, street=c.street, building_number=c.building_number,
            postal_code=c.postal_code,
            rating=round(float(avg), 1) if avg is not None else None,
            reviews=cnt or 0, badges=badges.get(c.id, frozenset()),
        ))

    with _lock:
        _cache["rows"], _cache["at"] = out, time.monotonic()
    return out


def reset() -> None:
    with _lock:
        _cache["rows"] = None


def cities(rows: list[IdxCafe]) -> list[City]:
    groups: dict[str, list[IdxCafe]] = {}
    for r in rows:
        groups.setdefault(r.city_slug, []).append(r)
    out = [
        City(
            slug=slug,
            name=Counter(x.city for x in g).most_common(1)[0][0],
            country=Counter(x.country for x in g).most_common(1)[0][0],
            count=len(g),
        )
        for slug, g in groups.items()
    ]
    out.sort(key=lambda c: (-c.count, c.name.lower()))
    return out


def city_cafes(rows: list[IdxCafe], city_slug: str) -> list[IdxCafe]:
    found = [r for r in rows if r.city_slug == city_slug]
    found.sort(key=lambda r: (-(r.rating or 0), -r.reviews, r.name.lower()))
    return found


def city_name(rows: list[IdxCafe]) -> str:
    return Counter(r.city for r in rows).most_common(1)[0][0]


def badge_counts(rows: list[IdxCafe]) -> Counter:
    c: Counter = Counter()
    for r in rows:
        c.update(r.badges)
    return c