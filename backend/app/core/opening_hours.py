from __future__ import annotations

from datetime import date as date_cls

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