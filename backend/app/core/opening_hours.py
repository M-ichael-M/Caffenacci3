from __future__ import annotations

from datetime import date as date_cls, timedelta
from typing import Callable

from sqlalchemy.orm import Session, selectinload

from app.models.cafe_profile import CafeProfile


def to_minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def from_minutes(m: int) -> str:
    hh = str((m // 60) % 24).zfill(2)
    mm = str(m % 60).zfill(2)
    return f"{hh}:{mm}"


def day_of_week(date_str: str) -> int:
    y, mo, d = date_str.split("-")
    return date_cls(int(y), int(mo), int(d)).weekday()


def get_effective_hours(cafe_id: str, date_str: str, db: Session) -> tuple[str | None, str | None]:
    """Jedno źródło prawdy o godzinach otwarcia kawiarni w danym dniu.

    Wyjątek godzinowy z profilu ma pierwszeństwo przed planem tygodniowym.
    (None, None) oznacza, że kawiarnia jest tego dnia zamknięta."""
    profile = (
        db.query(CafeProfile)
        .options(
            selectinload(CafeProfile.weekly_hours),
            selectinload(CafeProfile.hour_exceptions),
        )
        .filter(CafeProfile.cafe_id == cafe_id)
        .first()
    )
    if not profile:
        return None, None

    exception = next((e for e in profile.hour_exceptions if e.date == date_str), None)
    if exception:
        if exception.is_closed:
            return None, None
        return exception.open_time, exception.close_time

    dow = day_of_week(date_str)
    day_plan = next((h for h in profile.weekly_hours if h.day_of_week == dow), None)
    if not day_plan:
        return None, None
    return day_plan.open_time, day_plan.close_time


HoursFn = Callable[[str], tuple[str | None, str | None]]


def get_hour_exception(cafe_id: str, date_str: str, db: Session) -> tuple[str | None, str | None] | None:
    """None = brak wyjątku na ten dzień; (None, None) = wyjątkowo zamknięte."""
    profile = (
        db.query(CafeProfile)
        .options(selectinload(CafeProfile.hour_exceptions))
        .filter(CafeProfile.cafe_id == cafe_id).first()
    )
    if not profile:
        return None
    exc = next((e for e in profile.hour_exceptions if e.date == date_str), None)
    if exc is None:
        return None
    return (None, None) if exc.is_closed else (exc.open_time, exc.close_time)


def effective_hours_fn(cafe_id: str, db: Session) -> HoursFn:
    return lambda ds: get_effective_hours(cafe_id, ds, db)


def hours_to_session(open_time, close_time, day_offset: int = 0) -> tuple[int, int] | None:
    """Sesja w minutach od północy dnia bazowego. close <= open = przez północ."""
    if not open_time or not close_time:
        return None
    o, c = to_minutes(open_time), to_minutes(close_time)
    if c <= o:
        c += 1440
    return o + day_offset * 1440, c + day_offset * 1440


def sessions_for(date_str: str, hours_fn: HoursFn) -> list[tuple[int, int]]:
    """Sesje otwarcia dotykające dnia `date_str`, w minutach od jego północy.
    Ogon sesji z poprzedniego dnia (po północy) ma początek ujemny."""
    d = date_cls.fromisoformat(date_str)
    out: list[tuple[int, int]] = []
    prev = hours_to_session(*hours_fn((d - timedelta(days=1)).isoformat()), day_offset=-1)
    if prev and prev[1] > 0:
        out.append(prev)
    cur = hours_to_session(*hours_fn(date_str))
    if cur:
        out.append(cur)
    return out
