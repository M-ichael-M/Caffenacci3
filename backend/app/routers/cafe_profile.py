from __future__ import annotations

import os
import uuid
from datetime import date as date_cls, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, selectinload
from PIL import Image
import io

from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.config import settings as app_settings
from app.models.cafe import Cafe
from app.models.cafe_profile import (
    CafeProfile, ProfileWeeklyHours, ProfileHourException,
    ProfileSocialLink, ProfileEmployee,
)
from app.schemas.cafe_profile import (
    CafeProfileIn, CafeProfileOut, PublicCafeProfileOut,
    HourExceptionIn, HourExceptionOut,
    MAX_EXCEPTION_DAYS_AHEAD,
)

router = APIRouter(prefix="/profile", tags=["cafe-profile"])
bearer_scheme = HTTPBearer()

# ── Konfiguracja uploadu logo ────────────────────────────────────────────────

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "logos")
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_LOGO_BYTES = 10 * 1024 * 1024  # 10 MB
MIN_LOGO_DIMENSION = 512
ALLOWED_LOGO_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}


# ── Auth helper ────────────────────────────────────────────────────────────

def get_current_cafe(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Cafe:
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy lub wygasły token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    cafe = db.query(Cafe).filter(Cafe.id == payload.get("sub")).first()
    if not cafe:
        raise HTTPException(status_code=404, detail="Kawiarnia nie znaleziona.")
    return cafe


def _default_weekly_hours(profile_id: str) -> list[ProfileWeeklyHours]:
    return [
        ProfileWeeklyHours(profile_id=profile_id, day_of_week=i, open_time=None, close_time=None)
        for i in range(7)
    ]


def _get_or_create_profile(cafe_id: str, db: Session) -> CafeProfile:
    p = (
        db.query(CafeProfile)
        .options(
            selectinload(CafeProfile.weekly_hours),
            selectinload(CafeProfile.hour_exceptions),
            selectinload(CafeProfile.social_links),
            selectinload(CafeProfile.employees),
        )
        .filter(CafeProfile.cafe_id == cafe_id)
        .first()
    )
    if not p:
        p = CafeProfile(cafe_id=cafe_id)
        db.add(p)
        db.flush()
        for h in _default_weekly_hours(p.id):
            db.add(h)
        db.commit()
        db.refresh(p)
        p = (
            db.query(CafeProfile)
            .options(
                selectinload(CafeProfile.weekly_hours),
                selectinload(CafeProfile.hour_exceptions),
                selectinload(CafeProfile.social_links),
                selectinload(CafeProfile.employees),
            )
            .filter(CafeProfile.id == p.id)
            .first()
        )
    return p


def _logo_url(cafe_id: str, profile: CafeProfile) -> str | None:
    if not profile.logo_path:
        return None
    return f"/profile/logo/{cafe_id}"


def _hours_complete(profile: CafeProfile) -> bool:
    # "Obowiązkowe" = plan tygodniowy istnieje i ma 7 wpisów (otwarte/zamknięte
    # to decyzja właściciela — sam fakt skonfigurowania planu wystarcza).
    return len(profile.weekly_hours) == 7


def _profile_to_out(cafe: Cafe, profile: CafeProfile) -> CafeProfileOut:
    logo_complete = bool(profile.logo_path)
    hours_complete = _hours_complete(profile)
    return CafeProfileOut(
        id=profile.id,
        cafe_id=cafe.id,
        owner_name=cafe.owner_name,
        email=cafe.email,
        phone=cafe.phone,
        cafe_name=cafe.cafe_name,
        country=cafe.country,
        city=cafe.city,
        street=cafe.street,
        building_number=cafe.building_number,
        postal_code=cafe.postal_code,
        contact_email=profile.contact_email,
        contact_email_visible=profile.contact_email_visible,
        contact_phone=profile.contact_phone,
        contact_phone_visible=profile.contact_phone_visible,
        description=profile.description,
        description_visible=profile.description_visible,
        latitude=profile.latitude,
        longitude=profile.longitude,
        location_visible=profile.location_visible,
        location_show_map=profile.location_show_map,
        location_show_gmaps_link=profile.location_show_gmaps_link,
        logo_url=_logo_url(cafe.id, profile),
        logo_complete=logo_complete,
        weekly_hours=profile.weekly_hours,
        hour_exceptions=profile.hour_exceptions,
        social_links=profile.social_links,
        employees=profile.employees,
        profile_complete=logo_complete and hours_complete,
        updated_at=profile.updated_at,
    )


# ══════════════════════════════════════════════════════════════════════════════
# GET / PUT — profil właściciela
# ══════════════════════════════════════════════════════════════════════════════

@router.get("", response_model=CafeProfileOut, summary="Pobierz profil kawiarni (właściciel)")
def get_profile(
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    profile = _get_or_create_profile(current_cafe.id, db)
    return _profile_to_out(current_cafe, profile)


@router.put("", response_model=CafeProfileOut, summary="Zapisz profil kawiarni")
def save_profile(
    payload:      CafeProfileIn,
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    profile = _get_or_create_profile(current_cafe.id, db)

    # ── Aktualizacja danych z rejestracji (Cafe) ────────────────────────────
    current_cafe.owner_name      = payload.owner_name
    current_cafe.phone           = payload.phone
    current_cafe.cafe_name       = payload.cafe_name
    current_cafe.country         = payload.country
    current_cafe.city            = payload.city
    current_cafe.street          = payload.street
    current_cafe.building_number = payload.building_number
    current_cafe.postal_code     = payload.postal_code

    # ── Aktualizacja profilu ────────────────────────────────────────────────
    profile.contact_email         = payload.contact_email
    profile.contact_email_visible = payload.contact_email_visible if payload.contact_email else False
    profile.contact_phone         = payload.contact_phone
    profile.contact_phone_visible = payload.contact_phone_visible if payload.contact_phone else False
    profile.description           = payload.description
    profile.description_visible   = payload.description_visible if payload.description else False

    # Lokalizacja na mapie
    profile.latitude                 = payload.latitude
    profile.longitude                = payload.longitude
    profile.location_visible         = payload.location_visible
    profile.location_show_map        = payload.location_show_map
    profile.location_show_gmaps_link = payload.location_show_gmaps_link

    profile.updated_at            = datetime.utcnow()

    # Godziny tygodniowe — replace-all
    db.query(ProfileWeeklyHours).filter(ProfileWeeklyHours.profile_id == profile.id).delete()
    for h in payload.weekly_hours:
        db.add(ProfileWeeklyHours(
            profile_id=profile.id,
            day_of_week=h.day_of_week,
            open_time=h.open_time,
            close_time=h.close_time,
        ))

    # Social links — replace-all
    db.query(ProfileSocialLink).filter(ProfileSocialLink.profile_id == profile.id).delete()
    for s in payload.social_links:
        db.add(ProfileSocialLink(
            profile_id=profile.id,
            platform=s.platform,
            url=s.url,
            label=s.label,
            visible=s.visible,
            position=s.position,
        ))

    # Pracownicy — replace-all
    db.query(ProfileEmployee).filter(ProfileEmployee.profile_id == profile.id).delete()
    for e in payload.employees:
        db.add(ProfileEmployee(
            profile_id=profile.id,
            full_name=e.full_name,
            role=e.role,
            bio=e.bio,
            visible=e.visible,
            position=e.position,
        ))

    db.commit()

    profile = _get_or_create_profile(current_cafe.id, db)
    return _profile_to_out(current_cafe, profile)


# ══════════════════════════════════════════════════════════════════════════════
# LOGO — upload / pobranie / usunięcie
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/logo", response_model=CafeProfileOut, summary="Wgraj logo kawiarni")
async def upload_logo(
    file:         UploadFile = File(...),
    current_cafe: Cafe       = Depends(get_current_cafe),
    db:           Session    = Depends(get_db),
):
    if file.content_type not in ALLOWED_LOGO_CONTENT_TYPES:
        raise HTTPException(400, detail="Dozwolone formaty: PNG, JPEG, WEBP.")

    raw = await file.read()
    if len(raw) > MAX_LOGO_BYTES:
        raise HTTPException(400, detail="Plik jest za duży. Maksymalny rozmiar to 10 MB.")

    try:
        img = Image.open(io.BytesIO(raw))
        img.verify()
        # verify() psuje obiekt do dalszego użytku — otwórz ponownie
        img = Image.open(io.BytesIO(raw))
    except Exception:
        raise HTTPException(400, detail="Plik nie jest prawidłowym obrazem.")

    width, height = img.size
    if width != height:
        raise HTTPException(400, detail="Logo musi mieć proporcje 1:1 (kwadrat).")
    if width < MIN_LOGO_DIMENSION or height < MIN_LOGO_DIMENSION:
        raise HTTPException(
            400,
            detail=f"Logo musi mieć co najmniej {MIN_LOGO_DIMENSION}×{MIN_LOGO_DIMENSION} pikseli.",
        )

    profile = _get_or_create_profile(current_cafe.id, db)

    # Usuń stary plik jeśli istnieje
    if profile.logo_path:
        old_path = os.path.join(UPLOAD_DIR, profile.logo_path)
        if os.path.exists(old_path):
            os.remove(old_path)

    ext = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}[file.content_type]
    filename = f"{current_cafe.id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(raw)

    profile.logo_path  = filename
    profile.updated_at = datetime.utcnow()
    db.commit()

    profile = _get_or_create_profile(current_cafe.id, db)
    return _profile_to_out(current_cafe, profile)


@router.delete("/logo", response_model=CafeProfileOut, summary="Usuń logo kawiarni")
def delete_logo(
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    profile = _get_or_create_profile(current_cafe.id, db)
    if profile.logo_path:
        old_path = os.path.join(UPLOAD_DIR, profile.logo_path)
        if os.path.exists(old_path):
            os.remove(old_path)
        profile.logo_path  = None
        profile.updated_at = datetime.utcnow()
        db.commit()
    profile = _get_or_create_profile(current_cafe.id, db)
    return _profile_to_out(current_cafe, profile)


@router.get("/logo/{cafe_id}", summary="Pobierz plik logo (publiczny)")
def get_logo_file(cafe_id: str, db: Session = Depends(get_db)):
    from fastapi.responses import FileResponse

    profile = db.query(CafeProfile).filter(CafeProfile.cafe_id == cafe_id).first()
    if not profile or not profile.logo_path:
        raise HTTPException(404, detail="Logo nie zostało jeszcze dodane.")
    filepath = os.path.join(UPLOAD_DIR, profile.logo_path)
    if not os.path.exists(filepath):
        raise HTTPException(404, detail="Plik logo nie istnieje.")
    return FileResponse(filepath)


# ══════════════════════════════════════════════════════════════════════════════
# WYJĄTKI GODZINOWE (konkretne daty, do 3 tygodni do przodu)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/hour-exceptions", response_model=list[HourExceptionOut],
            summary="Pobierz wyjątki godzinowe")
def list_hour_exceptions(
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    profile = _get_or_create_profile(current_cafe.id, db)
    return profile.hour_exceptions


@router.put("/hour-exceptions/{date}", response_model=HourExceptionOut,
            summary="Ustaw/nadpisz wyjątek godzinowy dla konkretnej daty")
def set_hour_exception(
    date: str,
    payload: HourExceptionIn,
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    if date != payload.date:
        raise HTTPException(400, detail="Data w ścieżce i w treści żądania muszą być zgodne.")

    y, mo, d = date.split("-")
    target_date = date_cls(int(y), int(mo), int(d))
    today = date_cls.today()
    if target_date < today:
        raise HTTPException(400, detail="Nie można ustawić wyjątku dla daty w przeszłości.")
    if target_date > today + timedelta(days=MAX_EXCEPTION_DAYS_AHEAD):
        raise HTTPException(
            400,
            detail=f"Wyjątki można ustawiać maksymalnie {MAX_EXCEPTION_DAYS_AHEAD} dni do przodu (3 tygodnie).",
        )

    profile = _get_or_create_profile(current_cafe.id, db)

    existing = next((e for e in profile.hour_exceptions if e.date == date), None)
    if existing:
        existing.is_closed  = payload.is_closed
        existing.open_time  = payload.open_time
        existing.close_time = payload.close_time
    else:
        existing = ProfileHourException(
            profile_id=profile.id,
            date=date,
            is_closed=payload.is_closed,
            open_time=payload.open_time,
            close_time=payload.close_time,
        )
        db.add(existing)

    profile.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(existing)
    return existing


@router.delete("/hour-exceptions/{date}", status_code=status.HTTP_204_NO_CONTENT,
               summary="Usuń wyjątek godzinowy (wraca do planu tygodniowego)")
def delete_hour_exception(
    date: str,
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    profile = _get_or_create_profile(current_cafe.id, db)
    existing = next((e for e in profile.hour_exceptions if e.date == date), None)
    if not existing:
        raise HTTPException(404, detail="Wyjątek dla tej daty nie istnieje.")
    db.delete(existing)
    profile.updated_at = datetime.utcnow()
    db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# PUBLICZNA WIZYTÓWKA — tylko widoczne pola (na przyszłość)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/public/{cafe_id}", response_model=PublicCafeProfileOut,
            summary="Publiczny widok profilu kawiarni (wizytówka)")
def get_public_profile(cafe_id: str, db: Session = Depends(get_db)):
    cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
    if not cafe:
        raise HTTPException(404, detail="Kawiarnia nie istnieje.")

    profile = (
        db.query(CafeProfile)
        .options(
            selectinload(CafeProfile.weekly_hours),
            selectinload(CafeProfile.hour_exceptions),
            selectinload(CafeProfile.social_links),
            selectinload(CafeProfile.employees),
        )
        .filter(CafeProfile.cafe_id == cafe_id)
        .first()
    )

    if not profile:
        # Brak profilu — zwróć minimalną wizytówkę z samych danych rejestracyjnych
        return PublicCafeProfileOut(
            cafe_id=cafe.id,
            cafe_name=cafe.cafe_name,
            country=cafe.country,
            city=cafe.city,
            street=cafe.street,
            building_number=cafe.building_number,
            postal_code=cafe.postal_code,
            contact_email=None,
            contact_phone=None,
            description=None,
            logo_url=None,
            latitude=None,
            longitude=None,
            location_show_map=False,
            location_show_gmaps_link=False,
            weekly_hours=[],
            hour_exceptions=[],
            social_links=[],
            employees=[],
        )

    # Lokalizacja jest widoczna publicznie tylko gdy właściciel to włączył
    # ORAZ pinezka faktycznie została ustawiona.
    loc_visible = bool(
        profile.location_visible
        and profile.latitude is not None
        and profile.longitude is not None
    )

    return PublicCafeProfileOut(
        cafe_id=cafe.id,
        cafe_name=cafe.cafe_name,
        country=cafe.country,
        city=cafe.city,
        street=cafe.street,
        building_number=cafe.building_number,
        postal_code=cafe.postal_code,
        contact_email=profile.contact_email if profile.contact_email_visible else None,
        contact_phone=profile.contact_phone if profile.contact_phone_visible else None,
        description=profile.description if profile.description_visible else None,
        logo_url=_logo_url(cafe.id, profile),
        latitude=profile.latitude if loc_visible else None,
        longitude=profile.longitude if loc_visible else None,
        location_show_map=profile.location_show_map if loc_visible else False,
        location_show_gmaps_link=profile.location_show_gmaps_link if loc_visible else False,
        weekly_hours=[
            {"day_of_week": h.day_of_week, "open_time": h.open_time, "close_time": h.close_time}
            for h in profile.weekly_hours
        ],
        hour_exceptions=[
            {"date": e.date, "is_closed": e.is_closed, "open_time": e.open_time, "close_time": e.close_time}
            for e in profile.hour_exceptions
        ],
        social_links=[
            {"platform": s.platform, "url": s.url, "label": s.label}
            for s in profile.social_links if s.visible
        ],
        employees=[
            {"full_name": e.full_name, "role": e.role, "bio": e.bio}
            for e in profile.employees if e.visible
        ],
    )