from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.cafe import Cafe
from app.models.site import CafeSite
from app.models.cafe_profile import CafeProfile
from app.models.menu import MenuSection
from app.models.order import OrderSettings
from app.models.reservation import ReservationSettings
from app.models.review import Review
from app.models.gallery import CafeGalleryImage
from app.schemas.gallery import PublicGalleryImageOut
from app.schemas.site import (
    CafeSiteSettingsIn, CafeSiteSettingsOut, PublicSiteOut,
    ALLOWED_TEMPLATES, ALLOWED_PALETTES,
)

router = APIRouter(prefix="/site", tags=["site"])
bearer_scheme = HTTPBearer()


# ── Auth helper (właściciel) ─────────────────────────────────────────────────

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


def _get_or_create_site(cafe_id: str, db: Session) -> CafeSite:
    s = db.query(CafeSite).filter(CafeSite.cafe_id == cafe_id).first()
    if not s:
        s = CafeSite(cafe_id=cafe_id)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


def _logo_url(cafe_id: str, profile: CafeProfile | None) -> str | None:
    if profile and profile.logo_path:
        return f"/profile/logo/{cafe_id}"
    return None


# ══════════════════════════════════════════════════════════════════════════════
# OPCJE — dostępne szablony i palety (do wyświetlenia w kreatorze właściciela)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/options", summary="Dostępne szablony i palety kolorów")
def get_options():
    return {"templates": sorted(ALLOWED_TEMPLATES), "palettes": sorted(ALLOWED_PALETTES)}


# ══════════════════════════════════════════════════════════════════════════════
# USTAWIENIA STRONY (właściciel)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/settings", response_model=CafeSiteSettingsOut,
            summary="Pobierz ustawienia wygenerowanej strony")
def get_settings(
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    return _get_or_create_site(current_cafe.id, db)


@router.put("/settings", response_model=CafeSiteSettingsOut,
            summary="Zapisz szablon i paletę kolorów strony")
def save_settings(
    payload:      CafeSiteSettingsIn,
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    s = _get_or_create_site(current_cafe.id, db)
    s.template   = payload.template
    s.palette    = payload.palette
    s.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(s)
    return s


# ══════════════════════════════════════════════════════════════════════════════
# PUBLICZNY BUNDLE — wszystko czego potrzebuje wygenerowana strona kawiarni
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/public/{cafe_id}", response_model=PublicSiteOut,
            summary="Pobierz w pełni złożoną, publiczną stronę kawiarni")
def get_public_site(cafe_id: str, db: Session = Depends(get_db)):
    cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
    if not cafe:
        raise HTTPException(404, detail="Kawiarnia nie istnieje.")

    site = _get_or_create_site(cafe_id, db)

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

    loc_visible = bool(
        profile and profile.location_visible
        and profile.latitude is not None and profile.longitude is not None
    )

    menu_sections_raw = (
        db.query(MenuSection)
        .options(selectinload(MenuSection.items))
        .filter(MenuSection.cafe_id == cafe_id)
        .order_by(MenuSection.position)
        .all()
    )

    order_settings = db.query(OrderSettings).filter(OrderSettings.cafe_id == cafe_id).first()
    res_settings   = db.query(ReservationSettings).filter(ReservationSettings.cafe_id == cafe_id).first()

    reviews_rows = (
        db.query(Review)
        .filter(Review.cafe_id == cafe_id)
        .order_by(Review.created_at.desc())
        .all()
    )
    agg = (
        db.query(func.avg(Review.rating), func.count(Review.id))
        .filter(Review.cafe_id == cafe_id)
        .first()
    )
    reviews_average = round(float(agg[0]), 2) if agg and agg[0] is not None else 0.0
    reviews_count = agg[1] if agg else 0

    gallery_images: list[PublicGalleryImageOut] = []
    if profile and profile.gallery_visible:
        gallery_rows = (
            db.query(CafeGalleryImage)
            .filter(CafeGalleryImage.cafe_id == cafe_id)
            .order_by(CafeGalleryImage.position)
            .all()
        )
        gallery_images = [
            PublicGalleryImageOut(url=f"/profile/gallery/{cafe_id}/{g.id}")
            for g in gallery_rows
        ]

    return PublicSiteOut(
        cafe_id=cafe.id,
        cafe_name=cafe.cafe_name,
        template=site.template,
        palette=site.palette,

        country=cafe.country,
        city=cafe.city,
        street=cafe.street,
        building_number=cafe.building_number,
        postal_code=cafe.postal_code,

        contact_email=(profile.contact_email if profile and profile.contact_email_visible else None),
        contact_phone=(profile.contact_phone if profile and profile.contact_phone_visible else None),
        description=(profile.description if profile and profile.description_visible else None),
        logo_url=_logo_url(cafe.id, profile),

        latitude=(profile.latitude if loc_visible else None),
        longitude=(profile.longitude if loc_visible else None),
        location_show_map=(profile.location_show_map if loc_visible else False),
        location_show_gmaps_link=(profile.location_show_gmaps_link if loc_visible else False),

        weekly_hours=(profile.weekly_hours if profile else []),
        hour_exceptions=(profile.hour_exceptions if profile else []),
        social_links=[s for s in (profile.social_links if profile else []) if s.visible],
        employees=[e for e in (profile.employees if profile else []) if e.visible],

        menu_sections=menu_sections_raw,

        orders_enabled=bool(order_settings and order_settings.enabled),
        reservations_enabled=bool(res_settings and res_settings.enabled),
        reservations_mode=(res_settings.mode if res_settings else "simple"),

        reviews_average=reviews_average,
        reviews_count=reviews_count,
        reviews=reviews_rows,

        gallery_images=gallery_images,
    )