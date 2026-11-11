"""Jedno miejsce, w którym backend liczy „teraz” i „dzisiaj” — zawsze w strefie kawiarni."""
from __future__ import annotations

from datetime import date, datetime
from functools import lru_cache
from typing import Iterable
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.languages import DEFAULT_TIME_ZONE
from app.models.translation import CafeLanguageSettings


@lru_cache(maxsize=128)
def zone(name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(name or DEFAULT_TIME_ZONE)
    except Exception:
        return ZoneInfo(DEFAULT_TIME_ZONE)


def cafe_tz_name(cafe_id: str, db: Session) -> str:
    row = db.query(CafeLanguageSettings.time_zone).filter(
        CafeLanguageSettings.cafe_id == cafe_id).first()
    return row[0] if row else DEFAULT_TIME_ZONE


def cafe_tz(cafe_id: str, db: Session) -> ZoneInfo:
    return zone(cafe_tz_name(cafe_id, db))


def cafe_tz_names(cafe_ids: Iterable[str], db: Session) -> dict[str, str]:
    ids = list(set(cafe_ids))
    found = dict(
        db.query(CafeLanguageSettings.cafe_id, CafeLanguageSettings.time_zone)
        .filter(CafeLanguageSettings.cafe_id.in_(ids)).all()
    ) if ids else {}
    return {cid: found.get(cid, DEFAULT_TIME_ZONE) for cid in ids}


def cafe_now(tz: ZoneInfo) -> datetime:
    return datetime.now(tz)


def cafe_today(tz: ZoneInfo) -> date:
    return cafe_now(tz).date()


def cafe_datetime(date_str: str, time_str: str, tz: ZoneInfo) -> datetime:
    """Czas ścienny kawiarni ('YYYY-MM-DD', 'HH:MM') jako aware datetime."""
    y, mo, d = map(int, date_str.split("-"))
    h, mi = map(int, time_str.split(":"))
    return datetime(y, mo, d, h, mi, tzinfo=tz)