from __future__ import annotations

import math
import re
from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import and_, func, literal, or_, select, union
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.access import live_cafe_ids
from app.core.cafe_time import zone, cafe_now
from app.core.opening_hours import day_of_week, sessions_for
from app.core.languages import DEFAULT_TIME_ZONE
from app.core.security import decode_access_token
from app.core.images import logo_url
from app.models.cafe import Cafe
from app.models.client import Client
from app.models.cafe_profile import CafeProfile, CafeProfileBadge
from app.models.loyalty import LoyaltyTransaction
from app.models.order import Order, OrderSettings, OrderStatus
from app.models.reservation import Reservation, ReservationSettings, ReservationStatus
from app.models.review import Review
from app.models.site import CafeSite
from app.models.translation import CafeLanguageSettings
from app.schemas.badges import ALLOWED_BADGE_KEYS
from app.schemas.cafe_search import (
    CafeSearchResultOut, CafeSearchListOut, CafeSearchMetaOut, TodayHoursOut,
    CafeMapPointOut, CafeMapOut,
)

router = APIRouter(prefix="/cafes", tags=["cafe-search"])

MAX_RESULTS = 50
MAX_CANDIDATES = 1000      # górny limit przed filtrami liczonymi w Pythonie
MAX_RADIUS_KM = 100

optional_bearer = HTTPBearer(auto_error=False)


def get_optional_client_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer),
    db: Session = Depends(get_db),
) -> str | None:
    """Return a client ID or None; search remains public for all other requests."""

    if not credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload or payload.get("role") != "client":
        return None
    row = db.query(Client.id).filter(Client.id == payload.get("sub")).first()
    return row[0] if row else None


def _visited_subquery(client_id: str, db: Session):
    """Cafes where this client has completed an eligible activity."""
    timezone_rows = db.query(CafeLanguageSettings.time_zone, Cafe.id).select_from(Cafe).outerjoin(
        CafeLanguageSettings, CafeLanguageSettings.cafe_id == Cafe.id
    ).all()
    cafes_by_timezone: dict[str, list[str]] = {}
    for tz_name, cafe_id in timezone_rows:
        tz = tz_name or DEFAULT_TIME_ZONE
        cafes_by_timezone.setdefault(tz, []).append(cafe_id)
    reservation_cutoffs = [
        and_(Reservation.cafe_id.in_(cafe_ids),
             Reservation.date < cafe_now(zone(tz_name)).date().isoformat())
        for tz_name, cafe_ids in cafes_by_timezone.items()
    ]
    return union(
        select(Order.cafe_id.label("cafe_id")).where(
            Order.client_id == client_id, Order.status == OrderStatus.completed),
        select(Reservation.cafe_id.label("cafe_id")).where(
            Reservation.client_id == client_id,
            Reservation.status == ReservationStatus.confirmed,
            or_(*reservation_cutoffs) if reservation_cutoffs else False),
        select(LoyaltyTransaction.cafe_id.label("cafe_id")).where(
            LoyaltyTransaction.client_id == client_id,
            LoyaltyTransaction.kind.in_(("earn_points", "redeem_points", "add_stamp"))),
    ).subquery()


# ── Czas / godziny ──────────────────────────────────────────────────────────

def _today_hours(profile: CafeProfile | None, now: datetime) -> TodayHoursOut | None:
    if not profile:
        return None
    today_str = now.date().isoformat()
    dow = now.weekday()

    exception = next((e for e in profile.hour_exceptions if e.date == today_str), None)
    if exception:
        today = TodayHoursOut(
            is_closed=exception.is_closed or not (exception.open_time and exception.close_time),
            open_time=exception.open_time,
            close_time=exception.close_time,
        )
    else:
        day_plan = next((h for h in profile.weekly_hours if h.day_of_week == dow), None)
        today = TodayHoursOut(
            is_closed=day_plan is None or day_plan.open_time is None or day_plan.close_time is None,
            open_time=day_plan.open_time if day_plan else None,
            close_time=day_plan.close_time if day_plan else None,
        ) if day_plan else None

    def hours(ds: str):
        exc = next((e for e in profile.hour_exceptions if e.date == ds), None)
        if exc:
            return (None, None) if exc.is_closed else (exc.open_time, exc.close_time)
        p = next((h for h in profile.weekly_hours if h.day_of_week == day_of_week(ds)), None)
        return (p.open_time, p.close_time) if p else (None, None)

    cur = now.hour * 60 + now.minute
    if any(a < 0 <= cur < b for a, b in sessions_for(today_str, hours)):
        previous_hours = hours((now.date() - timedelta(days=1)).isoformat())
        return TodayHoursOut(is_closed=False, open_time=previous_hours[0], close_time=previous_hours[1])
    return today


def _is_open_now(profile: CafeProfile | None, now: datetime) -> bool | None:
    if not profile:
        return None
    cur = now.hour * 60 + now.minute

    def hours(ds: str):
        exc = next((e for e in profile.hour_exceptions if e.date == ds), None)
        if exc:
            return (None, None) if exc.is_closed else (exc.open_time, exc.close_time)
        p = next((h for h in profile.weekly_hours if h.day_of_week == day_of_week(ds)), None)
        return (p.open_time, p.close_time) if p else (None, None)

    return any(a <= cur < b for a, b in sessions_for(now.date().isoformat(), hours))


def _open_days(profile: CafeProfile | None) -> list[int]:
    if not profile:
        return []
    return sorted(h.day_of_week for h in profile.weekly_hours if h.open_time and h.close_time)


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371.0088 * math.asin(min(1.0, math.sqrt(a)))


def _logo_url(cafe_id: str, profile: CafeProfile | None) -> str | None:
    return logo_url(cafe_id, profile.logo_path) if profile else None


def _featured_badges(profile: CafeProfile | None) -> list[str]:
    if not profile:
        return []
    return [b.key for b in profile.badges if b.featured][:3]


# ── Meta: kraje + wykryty kraj użytkownika ──────────────────────────────────

@router.get(
    "/meta",
    response_model=CafeSearchMetaOut,
    summary="Kraje dostępne w wyszukiwarce + kraj wykryty po IP (jeśli CDN go podaje)",
)
def search_meta(request: Request, response: Response, db: Session = Depends(get_db)):
    # Odpowiedź zależy od nagłówka CDN → nie może być współdzielona w cache.
    response.headers["Cache-Control"] = "private, max-age=300"
    response.headers["Vary"] = "CF-IPCountry"

    code = (request.headers.get("cf-ipcountry") or "").strip().upper()
    detected = code if re.fullmatch(r"[A-Z]{2}", code) and code not in ("XX", "T1") else None

    rows = (
        db.query(Cafe.country, func.count(Cafe.id))
        .join(CafeSite, CafeSite.cafe_id == Cafe.id)
        .filter(Cafe.id.in_(live_cafe_ids()))
        .group_by(Cafe.country)
        .order_by(func.count(Cafe.id).desc(), Cafe.country)
        .all()
    )
    return CafeSearchMetaOut(countries=[r[0] for r in rows if r[0]], detected_country_code=detected)


# ── Mapa: wszystkie opublikowane kawiarnie z udostępnioną lokalizacją ───────

MAX_MAP_POINTS = 3000


@router.get("/map", response_model=CafeMapOut,
            summary="Punkty kawiarni do wyświetlenia na mapie (tylko z włączoną widocznością lokalizacji)")
def map_cafes(
    q: str | None = Query(None, max_length=200),
    country: str | None = Query(None, max_length=100),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Cafe, CafeProfile)
        .join(CafeSite, CafeSite.cafe_id == Cafe.id)
        .join(CafeProfile, CafeProfile.cafe_id == Cafe.id)
        .options(selectinload(CafeProfile.weekly_hours), selectinload(CafeProfile.hour_exceptions))
        .filter(
            Cafe.id.in_(live_cafe_ids()), CafeProfile.location_visible.is_(True),
            CafeProfile.latitude.isnot(None), CafeProfile.longitude.isnot(None),
        )
    )
    term = (q or "").strip()
    if term:
        fields = (Cafe.cafe_name, Cafe.city, Cafe.street, Cafe.postal_code)
        if db.get_bind().dialect.name == "postgresql":
            normalized = func.unaccent(func.lower(literal(term)))
            query = query.filter(or_(*[
                func.unaccent(func.lower(field)).ilike(func.concat("%", normalized, "%"))
                for field in fields
            ]))
        else:
            like = f"%{term}%"
            query = query.filter(or_(*[field.ilike(like) for field in fields]))
    if country and country.strip():
        query = query.filter(func.lower(Cafe.country) == country.strip().lower())

    rows = query.order_by(Cafe.cafe_name).limit(MAX_MAP_POINTS).all()
    if not rows:
        return CafeMapOut(cafes=[], count=0)
    tz_map = dict(db.query(CafeLanguageSettings.cafe_id, CafeLanguageSettings.time_zone)
                  .filter(CafeLanguageSettings.cafe_id.in_([c.id for c, _ in rows])).all())
    points: list[CafeMapPointOut] = []
    for cafe, profile in rows:
        now = cafe_now(zone(tz_map.get(cafe.id)))
        today = _today_hours(profile, now)
        points.append(CafeMapPointOut(
            cafe_id=cafe.id, slug=cafe.slug or cafe.id, cafe_name=cafe.cafe_name,
            latitude=profile.latitude, longitude=profile.longitude,
            is_open_now=_is_open_now(profile, now),
            open_time=today.open_time if today and not today.is_closed else None,
            close_time=today.close_time if today and not today.is_closed else None,
            closed_today=bool(today and today.is_closed),
        ))
    return CafeMapOut(cafes=points, count=len(points))


# ── Wyszukiwarka ────────────────────────────────────────────────────────────

@router.get(
    "/search",
    response_model=CafeSearchListOut,
    summary="Wyszukaj opublikowane kawiarnie z filtrami (publiczne)",
)
def search_cafes(
    q: str | None = Query(None, max_length=200),
    country: str | None = Query(None, max_length=100),
    lat: float | None = Query(None, ge=-90, le=90),
    lng: float | None = Query(None, ge=-180, le=180),
    radius_km: float = Query(25, ge=1, le=MAX_RADIUS_KM),
    min_rating: float | None = Query(None, ge=1, le=5),
    min_reviews: int | None = Query(None, ge=1, le=1000),
    open_now: bool = False,
    open_days: list[int] = Query(default=[]),
    reservations: bool = False,
    orders: bool = False,
    badges: list[str] = Query(default=[]),
    sort: Literal["relevance", "distance", "rating", "name"] = "relevance",
    visited: Literal["any", "visited", "not_visited"] = "any",
    client_id: str | None = Depends(get_optional_client_id),
    db: Session = Depends(get_db),
):
    if (lat is None) != (lng is None):
        raise HTTPException(400, detail="Parametry lat i lng muszą być podane razem.")
    near = lat is not None and lng is not None

    days = sorted(set(open_days))
    if any(d < 0 or d > 6 for d in days):
        raise HTTPException(400, detail="Dni otwarcia muszą być z zakresu 0–6.")
    wanted_badges = sorted(set(badges))
    unknown = [b for b in wanted_badges if b not in ALLOWED_BADGE_KEYS]
    if unknown:
        raise HTTPException(400, detail=f"Nieznane plakietki: {', '.join(unknown)}")
    if visited != "any" and not client_id:
        raise HTTPException(401, detail="Zaloguj si\u0119 na konto go\u015bcia, aby filtrowa\u0107 kawiarnie po odwiedzinach.")
    visited_sq = _visited_subquery(client_id, db) if client_id else None

    # Średnia ocen liczona w SQL (jedno zapytanie, bez N+1)
    rating_sq = (
        db.query(
            Review.cafe_id.label("cafe_id"),
            func.avg(Review.rating).label("avg"),
            func.count(Review.id).label("cnt"),
        )
        .group_by(Review.cafe_id)
        .subquery()
    )

    query = (
        db.query(Cafe, rating_sq.c.avg, rating_sq.c.cnt)
        .join(CafeSite, CafeSite.cafe_id == Cafe.id)
        .outerjoin(rating_sq, rating_sq.c.cafe_id == Cafe.id)
        .outerjoin(CafeProfile, CafeProfile.cafe_id == Cafe.id)
        .filter(Cafe.id.in_(live_cafe_ids()))
    )

    # ── Tekst ──
    term = (q or "").strip()
    postgres_rank = None
    if term:
        if db.get_bind().dialect.name == "postgresql":
            fields = (Cafe.cafe_name, Cafe.city, Cafe.street, Cafe.postal_code)
            normalized_term = func.unaccent(func.lower(literal(term)))
            normalized_fields = [func.unaccent(func.lower(f)) for f in fields]
            contains = [f.ilike(func.concat("%", normalized_term, "%")) for f in normalized_fields]
            similarities = [func.similarity(f, normalized_term) for f in normalized_fields]
            postgres_rank = func.greatest(*similarities)
            query = query.filter(or_(*contains, *[s > 0.25 for s in similarities]))
        else:
            like = f"%{term}%"
            query = query.filter(
                Cafe.cafe_name.ilike(like) | Cafe.city.ilike(like)
                | Cafe.street.ilike(like) | Cafe.postal_code.ilike(like)
            )

    # ── Kraj ──
    if country and country.strip():
        query = query.filter(func.lower(Cafe.country) == country.strip().lower())

    # ── Opinie ──
    if min_rating is not None:
        query = query.filter(rating_sq.c.avg >= min_rating)
    if min_reviews is not None:
        query = query.filter(rating_sq.c.cnt >= min_reviews)

    # ── Rezerwacje / zamówienia ──
    if reservations:
        query = query.filter(Cafe.id.in_(
            select(ReservationSettings.cafe_id).where(ReservationSettings.enabled.is_(True))))
    if orders:
        query = query.filter(Cafe.id.in_(
            select(OrderSettings.cafe_id).where(OrderSettings.enabled.is_(True))))

    # Visited / not visited
    if visited_sq is not None and visited == "visited":
        query = query.filter(Cafe.id.in_(select(visited_sq.c.cafe_id)))
    elif visited_sq is not None and visited == "not_visited":
        query = query.filter(Cafe.id.notin_(select(visited_sq.c.cafe_id)))

    # ── Plakietki (kawiarnia musi mieć WSZYSTKIE zaznaczone) ──
    for key in wanted_badges:
        query = query.filter(Cafe.id.in_(
            select(CafeProfile.cafe_id)
            .join(CafeProfileBadge, CafeProfileBadge.profile_id == CafeProfile.id)
            .where(CafeProfileBadge.key == key)
        ))

    # ── W okolicy: prefiltr prostokątem (indeksowalny), dokładny dystans niżej ──
    if near:
        dlat = radius_km / 111.0
        dlng = radius_km / (111.32 * max(math.cos(math.radians(lat)), 0.01))
        query = query.filter(
            CafeProfile.location_visible.is_(True),
            CafeProfile.latitude.between(lat - dlat, lat + dlat),
            CafeProfile.longitude.between(lng - dlng, lng + dlng),
        )

    if postgres_rank is not None:
        query = query.order_by(postgres_rank.desc(), Cafe.cafe_name)
    else:
        query = query.order_by(Cafe.cafe_name)
    rows = query.limit(MAX_CANDIDATES).all()

    cafe_ids = [r[0].id for r in rows]
    if not cafe_ids:
        return CafeSearchListOut(results=[], count=0)

    profiles = {
        p.cafe_id: p
        for p in (
            db.query(CafeProfile)
            .options(
                selectinload(CafeProfile.weekly_hours),
                selectinload(CafeProfile.hour_exceptions),
                selectinload(CafeProfile.badges),
            )
            .filter(CafeProfile.cafe_id.in_(cafe_ids))
            .all()
        )
    }
    tz_map = dict(
        db.query(CafeLanguageSettings.cafe_id, CafeLanguageSettings.time_zone)
        .filter(CafeLanguageSettings.cafe_id.in_(cafe_ids)).all()
    )
    res_on = {r[0] for r in db.query(ReservationSettings.cafe_id).filter(
        ReservationSettings.cafe_id.in_(cafe_ids), ReservationSettings.enabled.is_(True)).all()}
    ord_on = {r[0] for r in db.query(OrderSettings.cafe_id).filter(
        OrderSettings.cafe_id.in_(cafe_ids), OrderSettings.enabled.is_(True)).all()}
    visited_ids: set[str] = set()
    if visited_sq is not None:
        visited_ids = {r[0] for r in db.execute(
            select(visited_sq.c.cafe_id).where(visited_sq.c.cafe_id.in_(cafe_ids))).all()}

    results: list[CafeSearchResultOut] = []
    for cafe, avg, cnt in rows:
        profile = profiles.get(cafe.id)

        dist = None
        if near and profile and profile.location_visible \
                and profile.latitude is not None and profile.longitude is not None:
            dist = _haversine_km(lat, lng, profile.latitude, profile.longitude)
        if near and (dist is None or dist > radius_km):
            continue

        now = cafe_now(zone(tz_map.get(cafe.id)))
        today = _today_hours(profile, now)
        is_open = _is_open_now(profile, now)
        if open_now and is_open is not True:
            continue

        cafe_days = _open_days(profile)
        if days and not set(days).issubset(cafe_days):
            continue

        results.append(CafeSearchResultOut(
            cafe_id=cafe.id,
            slug=cafe.slug or cafe.id,
            cafe_name=cafe.cafe_name,
            country=cafe.country,
            city=cafe.city,
            street=cafe.street,
            building_number=cafe.building_number,
            postal_code=cafe.postal_code,
            logo_url=_logo_url(cafe.id, profile),
            today_hours=today,
            featured_badges=_featured_badges(profile),
            average_rating=round(float(avg), 2) if avg is not None else None,
            review_count=cnt or 0,
            distance_km=round(dist, 1) if dist is not None else None,
            is_open_now=is_open,
            open_days=cafe_days,
            reservations_enabled=cafe.id in res_on,
            orders_enabled=cafe.id in ord_on,
            badges=[b.key for b in profile.badges] if profile else [],
            visited=(cafe.id in visited_ids) if client_id else None,
        ))

    # ── Sortowanie (stabilne; "relevance" zachowuje kolejność z SQL) ──
    if sort == "distance" and near:
        results.sort(key=lambda r: (r.distance_km is None, r.distance_km or 0))
    elif sort == "rating":
        results.sort(key=lambda r: (-(r.average_rating or 0), -r.review_count))
    elif sort == "name":
        results.sort(key=lambda r: r.cafe_name.lower())

    results = results[:MAX_RESULTS]
    return CafeSearchListOut(results=results, count=len(results))
