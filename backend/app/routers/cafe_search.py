from __future__ import annotations

from datetime import date as date_cls

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.models.cafe import Cafe
from app.models.cafe_profile import CafeProfile
from app.schemas.cafe_search import CafeSearchResultOut, CafeSearchListOut, TodayHoursOut

router = APIRouter(prefix="/cafes", tags=["cafe-search"])

MAX_RESULTS = 50


def _logo_url(cafe_id: str, profile: CafeProfile | None) -> str | None:
    if profile and profile.logo_path:
        return f"/profile/logo/{cafe_id}"
    return None


def _today_hours(profile: CafeProfile | None) -> TodayHoursOut | None:
    """Zwraca godziny otwarcia na dziś: najpierw sprawdza wyjątek dla
    konkretnej daty, w przeciwnym razie plan tygodniowy."""
    if not profile:
        return None

    today = date_cls.today()
    today_str = today.isoformat()
    dow = today.weekday()  # 0 = poniedziałek, tak jak w reszcie aplikacji

    exception = next((e for e in profile.hour_exceptions if e.date == today_str), None)
    if exception:
        return TodayHoursOut(
            is_closed=exception.is_closed,
            open_time=exception.open_time,
            close_time=exception.close_time,
        )

    day_plan = next((h for h in profile.weekly_hours if h.day_of_week == dow), None)
    if day_plan:
        is_closed = day_plan.open_time is None or day_plan.close_time is None
        return TodayHoursOut(
            is_closed=is_closed,
            open_time=day_plan.open_time,
            close_time=day_plan.close_time,
        )

    return None


@router.get(
    "/search",
    response_model=CafeSearchListOut,
    summary="Wyszukaj kawiarnie po nazwie / adresie / mieście (publiczne)",
)
def search_cafes(
    q: str | None = Query(None, max_length=200),
    db: Session = Depends(get_db),
):
    query = db.query(Cafe)

    term = (q or "").strip()
    if term:
        like = f"%{term}%"
        query = query.filter(
            (Cafe.cafe_name.ilike(like))
            | (Cafe.city.ilike(like))
            | (Cafe.street.ilike(like))
            | (Cafe.postal_code.ilike(like))
        )

    cafes = query.order_by(Cafe.cafe_name).limit(MAX_RESULTS).all()

    profiles: dict[str, CafeProfile] = {}
    cafe_ids = [c.id for c in cafes]
    if cafe_ids:
        profs = (
            db.query(CafeProfile)
            .options(
                selectinload(CafeProfile.weekly_hours),
                selectinload(CafeProfile.hour_exceptions),
            )
            .filter(CafeProfile.cafe_id.in_(cafe_ids))
            .all()
        )
        profiles = {p.cafe_id: p for p in profs}

    results = [
        CafeSearchResultOut(
            cafe_id=c.id,
            cafe_name=c.cafe_name,
            country=c.country,
            city=c.city,
            street=c.street,
            building_number=c.building_number,
            postal_code=c.postal_code,
            logo_url=_logo_url(c.id, profiles.get(c.id)),
            today_hours=_today_hours(profiles.get(c.id)),
        )
        for c in cafes
    ]

    return CafeSearchListOut(results=results, count=len(results))