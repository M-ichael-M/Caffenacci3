
"""Analityka bez cookies i bez przechowywania czegokolwiek na urządzeniu.

- Zapis: tylko liczniki dzienne + skrót odwiedzającego ważny jeden dzień.
- Surowe IP / User-Agent nigdy nie trafiają do bazy.
- Zapisy idą przez Core (nie ORM), żeby nie wyzwalać invalidacji page_cache."""
from __future__ import annotations

import hashlib
import hmac
import re
import time
from datetime import date as date_cls, datetime, timedelta, timezone
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from sqlalchemy import delete, distinct, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.currency import round_money
from app.core.languages import DEFAULT_TIME_ZONE
from app.models.analytics import AnalyticsDaily, AnalyticsVisitorDay
from app.models.cafe import Cafe
from app.models.loyalty import LoyaltyTransaction
from app.models.order import Order, OrderStatus
from app.models.reservation import Reservation, ReservationStatus
from app.models.review import Review
from app.models.site import CafeSite
from app.models.translation import CafeLanguageSettings

VISIT_GAP = timedelta(minutes=30)
VISITOR_RETENTION_DAYS = 2
DAILY_RETENTION_DAYS = 760          # ~25 miesięcy

# Biała lista zdarzeń — nic spoza niej nie jest zapisywane.
ALLOWED_EVENTS = {
    "nav_click", "phone_click", "email_click", "map_click", "social_click",
    "gallery_open", "menu_add", "checkout_open", "reservation_open",
    "review_open", "login_open", "register_open", "lang_switch",
}
ALLOWED_SRC = {"qr", "nfc", "flyer", "newsletter", "social"}
DIM_RE = re.compile(r"^[a-z0-9_-]{1,30}$")
BOT_RE = re.compile(
    r"bot|crawl|spider|slurp|headless|lighthouse|facebookexternalhit|preview|curl|wget|python-requests|monitor",
    re.I,
)

_CTX: dict[str, tuple[float, str | None]] = {}     # cafe_id -> (wygasa, strefa | None=nieopublikowana)
_RATE: dict[str, tuple[float, int]] = {}           # skrót -> (początek okna, licznik)
RATE_LIMIT_PER_MIN = 120


# ── Pomocnicze ─────────────────────────────────────────────────────────────

def _tz(name: str | None):
    try:
        return ZoneInfo(name or DEFAULT_TIME_ZONE)
    except Exception:
        return timezone.utc


def local_day(tz_name: str, now_utc: datetime) -> str:
    return now_utc.replace(tzinfo=timezone.utc).astimezone(_tz(tz_name)).strftime("%Y-%m-%d")


def cafe_timezone(db: Session, cafe_id: str) -> str | None:
    """Strefa kawiarni, jeśli jej strona jest OPUBLIKOWANA; None = nie zbieramy. Cache 60 s."""
    now = time.monotonic()
    hit = _CTX.get(cafe_id)
    if hit and hit[0] > now:
        return hit[1]
    published = db.query(CafeSite.id).filter(
        CafeSite.cafe_id == cafe_id, CafeSite.is_published.is_(True)
    ).first() is not None
    tz_name = None
    if published:
        row = db.query(CafeLanguageSettings.time_zone).filter(CafeLanguageSettings.cafe_id == cafe_id).first()
        tz_name = row[0] if row else DEFAULT_TIME_ZONE
    if len(_CTX) > 2000:
        _CTX.clear()
    _CTX[cafe_id] = (now + 60, tz_name)
    return tz_name


def visitor_hash(cafe_id: str, day: str, ip: str, ua: str) -> str:
    # Sól zależy od dnia -> ten sam człowiek następnego dnia dostaje inny skrót.
    salt = hmac.new(settings.SECRET_KEY.encode(), f"analytics:{day}".encode(), hashlib.sha256).digest()
    return hashlib.sha256(salt + f"{cafe_id}|{ip}|{ua}".encode()).hexdigest()[:32]


def rate_limited(key: str) -> bool:
    now = time.monotonic()
    start, count = _RATE.get(key, (now, 0))
    if now - start > 60:
        start, count = now, 0
    _RATE[key] = (start, count + 1)
    if len(_RATE) > 20000:
        _RATE.clear()
    return count + 1 > RATE_LIMIT_PER_MIN


def device_class(ua: str) -> str:
    u = ua.lower()
    if "ipad" in u or "tablet" in u or ("android" in u and "mobile" not in u):
        return "tablet"
    if "mobi" in u or "iphone" in u or "android" in u:
        return "mobile"
    return "desktop"


def classify_source(src: str | None, ref: str | None) -> str:
    """Kategoria źródła. Pełny referrer NIE jest nigdzie zapisywany — tylko kategoria."""
    if src and src.lower() in ALLOWED_SRC:
        return src.lower()
    if not ref:
        return "direct"
    host = (urlparse(ref).hostname or "").lower().removeprefix("www.")
    own = (urlparse(settings.PUBLIC_SITE_URL).hostname or "").lower().removeprefix("www.")
    if own and host == own:
        return "caffenacci"
    if any(h in host for h in ("google.", "bing.", "duckduckgo.", "ecosia.", "yahoo.", "brave.")):
        return "search"
    if any(h in host for h in ("facebook.", "instagram.", "t.co", "tiktok.", "linkedin.", "twitter.", "x.com")):
        return "social"
    return "other"


def _insert(db: Session):
    if db.get_bind().dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    return insert


def _bump(db: Session, cafe_id: str, day: str, metric: str, dim: str = "", n: int = 1) -> None:
    T = AnalyticsDaily.__table__
    ins = _insert(db)(T).values(cafe_id=cafe_id, day=day, metric=metric, dim=dim, value=n)
    db.execute(ins.on_conflict_do_update(
        index_elements=[T.c.cafe_id, T.c.day, T.c.metric, T.c.dim],
        set_={"value": T.c.value + ins.excluded.value},
    ))


# ── Zapis ──────────────────────────────────────────────────────────────────

def record(
    db: Session, *, cafe_id: str, tz_name: str, kind: str, ip: str, ua: str,
    name: str | None = None, dim: str | None = None, ref: str | None = None, src: str | None = None,
) -> None:
    if not ua or BOT_RE.search(ua):
        return
    now = datetime.utcnow()
    day = local_day(tz_name, now)
    vh = visitor_hash(cafe_id, day, ip, ua)
    if rate_limited(vh):
        return

    if kind == "event":
        if name not in ALLOWED_EVENTS:
            return
        clean = dim if dim and DIM_RE.match(dim) else ""
        _bump(db, cafe_id, day, f"event:{name}", clean)
        db.commit()
        return

    V = AnalyticsVisitorDay.__table__
    row = db.execute(select(V.c.last_seen).where(
        V.c.cafe_id == cafe_id, V.c.day == day, V.c.visitor_hash == vh)).first()

    new_visitor = False
    new_visit = False
    if row is None:
        inserted = db.execute(
            _insert(db)(V)
            .values(cafe_id=cafe_id, day=day, visitor_hash=vh, last_seen=now, pageviews=1)
            .on_conflict_do_nothing(index_elements=[V.c.cafe_id, V.c.day, V.c.visitor_hash])
            .returning(V.c.visitor_hash)
        ).first()
        new_visitor = inserted is not None
        new_visit = new_visitor
    else:
        new_visit = now - row.last_seen > VISIT_GAP
        db.execute(V.update().where(
            V.c.cafe_id == cafe_id, V.c.day == day, V.c.visitor_hash == vh,
        ).values(last_seen=now, pageviews=V.c.pageviews + 1))

    _bump(db, cafe_id, day, "pageviews")
    if new_visitor:
        _bump(db, cafe_id, day, "visitors")
    if new_visit:
        _bump(db, cafe_id, day, "visits")
        _bump(db, cafe_id, day, "visits_by_source", classify_source(src, ref))
        _bump(db, cafe_id, day, "visits_by_device", device_class(ua))
    db.commit()


# ── Retencja ───────────────────────────────────────────────────────────────

def purge(db: Session) -> tuple[int, int]:
    today = datetime.utcnow().date()
    v = db.execute(delete(AnalyticsVisitorDay).where(
        AnalyticsVisitorDay.day < (today - timedelta(days=VISITOR_RETENTION_DAYS)).isoformat()))
    d = db.execute(delete(AnalyticsDaily).where(
        AnalyticsDaily.day < (today - timedelta(days=DAILY_RETENTION_DAYS)).isoformat()))
    db.commit()
    return v.rowcount or 0, d.rowcount or 0


# ── Raport dla właściciela ─────────────────────────────────────────────────

def _utc_naive(d: date_cls, tz) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)


def _impact(db: Session, cafe_id: str, s: datetime, e: datetime) -> dict:
    """Dane z bazy (nie z trackera) — dokładne, bez estymacji."""
    o = db.query(Order).filter(Order.cafe_id == cafe_id, Order.created_at >= s, Order.created_at < e)
    orders_placed = o.count()
    completed = o.filter(Order.status == OrderStatus.completed)
    rev_rows = (
        db.query(Order.currency, func.coalesce(func.sum(Order.total_value), 0))
        .filter(Order.cafe_id == cafe_id, Order.created_at >= s, Order.created_at < e,
                Order.status == OrderStatus.completed)
        .group_by(Order.currency).all()
    )
    revenue_by_currency = {c: round_money(v, c) for c, v in rev_rows}
    order_clients = db.query(func.count(distinct(Order.client_id))).filter(
        Order.cafe_id == cafe_id, Order.created_at >= s, Order.created_at < e,
        Order.client_id.isnot(None)).scalar() or 0

    r = db.query(Reservation).filter(
        Reservation.cafe_id == cafe_id, Reservation.created_by_owner.is_(False),
        Reservation.created_at >= s, Reservation.created_at < e,
    )
    res_total = r.count()
    res_confirmed = r.filter(Reservation.status == ReservationStatus.confirmed).count()

    rv_count, rv_avg = db.query(func.count(Review.id), func.avg(Review.rating)).filter(
        Review.cafe_id == cafe_id, Review.created_at >= s, Review.created_at < e).first()

    LT = LoyaltyTransaction
    scanned_total = db.query(func.count(distinct(LT.client_id))).filter(LT.cafe_id == cafe_id).scalar() or 0
    scanned_period = db.query(func.count(distinct(LT.client_id))).filter(
        LT.cafe_id == cafe_id, LT.created_at >= s, LT.created_at < e).scalar() or 0
    tx_period = db.query(func.count(LT.id)).filter(
        LT.cafe_id == cafe_id, LT.created_at >= s, LT.created_at < e).scalar() or 0
    first = (db.query(LT.client_id, func.min(LT.created_at).label("f"))
             .filter(LT.cafe_id == cafe_id).group_by(LT.client_id).subquery())
    new_in_period = db.query(func.count()).select_from(first).filter(first.c.f >= s, first.c.f < e).scalar() or 0

    return {
        "orders": {"placed": orders_placed, "completed": completed.count(),
                   "revenue_by_currency": revenue_by_currency, "unique_clients": order_clients},
        "reservations": {"total": res_total, "confirmed": res_confirmed},
        "reviews": {"count": rv_count or 0, "average": round(float(rv_avg), 2) if rv_avg is not None else None},
        "loyalty": {"scanned_total": scanned_total, "scanned_period": scanned_period,
                    "new_in_period": new_in_period,
                    "returning_in_period": max(scanned_period - new_in_period, 0),
                    "transactions": tx_period},
    }


def build_summary(db: Session, cafe: Cafe, days: int, tz_name: str) -> dict:
    tz = _tz(tz_name)
    today = datetime.now(tz).date()
    start = today - timedelta(days=days - 1)
    prev_start = start - timedelta(days=days)

    series = {
        (start + timedelta(i)).isoformat(): {"day": (start + timedelta(i)).isoformat(),
                                             "pageviews": 0, "visits": 0, "visitors": 0}
        for i in range(days)
    }
    totals = {"pageviews": 0, "visits": 0, "visitors": 0}
    previous = {"pageviews": 0, "visits": 0, "visitors": 0}
    sources: dict[str, int] = {}
    devices: dict[str, int] = {}
    events: dict[str, dict] = {}

    rows = db.query(AnalyticsDaily).filter(
        AnalyticsDaily.cafe_id == cafe.id,
        AnalyticsDaily.day >= prev_start.isoformat(),
        AnalyticsDaily.day <= today.isoformat(),
    ).all()
    for r in rows:
        current = r.day in series
        if r.metric in totals:
            if current:
                series[r.day][r.metric] += r.value
                totals[r.metric] += r.value
            else:
                previous[r.metric] += r.value
        elif current and r.metric == "visits_by_source":
            sources[r.dim] = sources.get(r.dim, 0) + r.value
        elif current and r.metric == "visits_by_device":
            devices[r.dim] = devices.get(r.dim, 0) + r.value
        elif current and r.metric.startswith("event:"):
            ev = events.setdefault(r.metric[6:], {"total": 0, "dims": {}})
            ev["total"] += r.value
            if r.dim:
                ev["dims"][r.dim] = ev["dims"].get(r.dim, 0) + r.value

    share_url = (f"{settings.PUBLIC_SITE_URL.rstrip('/')}/kawiarnia/{cafe.slug}?src=qr" if cafe.slug else None)
    return {
        "days": days, "from": start.isoformat(), "to": today.isoformat(), "share_url": share_url,
        "totals": totals, "previous": previous, "series": list(series.values()),
        "sources": sources, "devices": devices, "events": events,
        "impact": _impact(db, cafe.id, _utc_naive(start, tz), _utc_naive(today + timedelta(days=1), tz)),
    }
