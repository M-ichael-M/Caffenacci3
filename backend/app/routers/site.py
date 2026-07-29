from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.slugs import generate_unique_slug
from app.models.cafe import Cafe
from app.models.site import CafeSite
from app.models.cafe_profile import CafeProfile
from app.models.menu import MenuSection
from app.models.order import OrderSettings
from app.models.reservation import ReservationSettings
from app.models.review import Review
from app.models.gallery import CafeGalleryImage
from app.models.news import NewsSettings, NewsPost
from app.schemas.gallery import PublicGalleryImageOut
from app.schemas.site import (
    CafeSiteSettingsIn, CafeSiteSettingsOut, PublicSiteOut, PublishStatusOut,
    SiteNewsPostOut,
    ALLOWED_TEMPLATES, ALLOWED_PALETTES,
)
from app.models.loyalty import LoyaltySettings
from app.routers.cafe_profile import _hours_complete
from app.routers.billing import has_active_access

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


def _parse_custom_palette(raw: str | None) -> dict[str, str] | None:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return None


def _site_to_out(s: CafeSite) -> CafeSiteSettingsOut:
    return CafeSiteSettingsOut(
        id=s.id,
        cafe_id=s.cafe_id,
        template=s.template,
        palette=s.palette,
        custom_palette=_parse_custom_palette(s.custom_palette_colors),
    )


def _logo_url(cafe_id: str, profile: CafeProfile | None) -> str | None:
    if profile and profile.logo_path:
        return f"/profile/logo/{cafe_id}"
    return None


def _ensure_slug(cafe: Cafe, db: Session) -> None:
    """Zabezpieczenie dla kawiarni sprzed wprowadzenia slugów — generuje go
    leniwie przy pierwszym zapytaniu, jeśli z jakiegoś powodu go brakuje."""
    if not cafe.slug:
        cafe.slug = generate_unique_slug(cafe.cafe_name, db, exclude_cafe_id=cafe.id)
        db.commit()
        db.refresh(cafe)


# ══════════════════════════════════════════════════════════════════════════════
# OPCJE — dostępne szablony i palety
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
    s = _get_or_create_site(current_cafe.id, db)
    return _site_to_out(s)


@router.put("/settings", response_model=CafeSiteSettingsOut,
            summary="Zapisz szablon i paletę kolorów strony")
def save_settings(
    payload:      CafeSiteSettingsIn,
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    s = _get_or_create_site(current_cafe.id, db)
    s.template = payload.template
    s.palette  = payload.palette
    s.custom_palette_colors = (
        json.dumps(payload.custom_palette) if payload.palette == "custom" else None
    )
    s.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(s)
    return _site_to_out(s)


# ══════════════════════════════════════════════════════════════════════════════
# PUBLIKACJA — wymogi, publikacja, wycofanie
# ══════════════════════════════════════════════════════════════════════════════

def _publish_requirements(cafe: Cafe, profile: CafeProfile | None, db: Session) -> list[str]:
    reasons: list[str] = []
    if not profile or not profile.logo_path:
        reasons.append("Dodaj logo kawiarni.")
    if not profile or not _hours_complete(profile):
        reasons.append("Uzupełnij plan godzin otwarcia.")
    if not has_active_access(cafe.id, db):
        reasons.append("Aktywuj subskrypcję lub kod promocyjny.")
    return reasons


def _publish_status_out(cafe: Cafe, site: CafeSite, reasons: list[str]) -> PublishStatusOut:
    return PublishStatusOut(
        is_published=site.is_published,
        can_publish=len(reasons) == 0,
        missing_reasons=reasons,
        slug=cafe.slug,
        public_path=f"/{cafe.slug}" if cafe.slug else None,
        published_at=site.published_at,
    )


@router.get("/publish-status", response_model=PublishStatusOut,
            summary="Sprawdź, czy stronę można opublikować")
def get_publish_status(
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    _ensure_slug(current_cafe, db)
    site = _get_or_create_site(current_cafe.id, db)
    profile = db.query(CafeProfile).filter(CafeProfile.cafe_id == current_cafe.id).first()
    reasons = _publish_requirements(current_cafe, profile, db)
    return _publish_status_out(current_cafe, site, reasons)


@router.post("/publish", response_model=PublishStatusOut, summary="Opublikuj stronę")
def publish_site(
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    _ensure_slug(current_cafe, db)
    site = _get_or_create_site(current_cafe.id, db)
    profile = db.query(CafeProfile).filter(CafeProfile.cafe_id == current_cafe.id).first()
    reasons = _publish_requirements(current_cafe, profile, db)
    if reasons:
        raise HTTPException(400, detail="Nie można opublikować strony — " + " ".join(reasons))

    site.is_published = True
    site.published_at = datetime.utcnow()
    db.commit()
    db.refresh(site)
    return _publish_status_out(current_cafe, site, [])


@router.post("/unpublish", response_model=PublishStatusOut, summary="Wycofaj publikację strony")
def unpublish_site(
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    site = _get_or_create_site(current_cafe.id, db)
    site.is_published = False
    db.commit()
    db.refresh(site)

    profile = db.query(CafeProfile).filter(CafeProfile.cafe_id == current_cafe.id).first()
    reasons = _publish_requirements(current_cafe, profile, db)
    return _publish_status_out(current_cafe, site, reasons)


# ══════════════════════════════════════════════════════════════════════════════
# PUBLICZNY BUNDLE — wszystko czego potrzebuje wygenerowana strona kawiarni
# ══════════════════════════════════════════════════════════════════════════════

def _build_public_site(cafe: Cafe, db: Session) -> PublicSiteOut:
    site = _get_or_create_site(cafe.id, db)
    custom_palette = _parse_custom_palette(site.custom_palette_colors)

    profile = (
        db.query(CafeProfile)
        .options(
            selectinload(CafeProfile.weekly_hours),
            selectinload(CafeProfile.hour_exceptions),
            selectinload(CafeProfile.social_links),
            selectinload(CafeProfile.employees),
        )
        .filter(CafeProfile.cafe_id == cafe.id)
        .first()
    )

    loc_visible = bool(
        profile and profile.location_visible
        and profile.latitude is not None and profile.longitude is not None
    )

    menu_sections_raw = (
        db.query(MenuSection)
        .options(selectinload(MenuSection.items))
        .filter(MenuSection.cafe_id == cafe.id)
        .order_by(MenuSection.position)
        .all()
    )

    order_settings = db.query(OrderSettings).filter(OrderSettings.cafe_id == cafe.id).first()
    res_settings   = db.query(ReservationSettings).filter(ReservationSettings.cafe_id == cafe.id).first()

    loyalty_settings = (
        db.query(LoyaltySettings)
        .options(selectinload(LoyaltySettings.rewards))
        .filter(LoyaltySettings.cafe_id == cafe.id)
        .first()
    )

    reviews_rows = (
        db.query(Review)
        .filter(Review.cafe_id == cafe.id)
        .order_by(Review.created_at.desc())
        .all()
    )
    agg = (
        db.query(func.avg(Review.rating), func.count(Review.id))
        .filter(Review.cafe_id == cafe.id)
        .first()
    )
    reviews_average = round(float(agg[0]), 2) if agg and agg[0] is not None else 0.0
    reviews_count = agg[1] if agg else 0

    gallery_images: list[PublicGalleryImageOut] = []
    if profile and profile.gallery_visible:
        gallery_rows = (
            db.query(CafeGalleryImage)
            .filter(CafeGalleryImage.cafe_id == cafe.id)
            .order_by(CafeGalleryImage.position)
            .all()
        )
        gallery_images = [
            PublicGalleryImageOut(url=f"/profile/gallery/{cafe.id}/{g.id}")
            for g in gallery_rows
        ]

    news_settings = db.query(NewsSettings).filter(NewsSettings.cafe_id == cafe.id).first()
    news_posts_out: list[SiteNewsPostOut] = []
    if news_settings and news_settings.enabled:
        news_rows = (
            db.query(NewsPost)
            .filter(NewsPost.cafe_id == cafe.id)
            .order_by(NewsPost.created_at.desc())
            .limit(3)
            .all()
        )
        news_posts_out = [
            SiteNewsPostOut(
                id=p.id,
                title=p.title,
                content=p.content,
                image_url=(f"/news/image/{cafe.id}/{p.id}" if p.image_path else None),
                created_at=p.created_at,
            )
            for p in news_rows
        ]

    return PublicSiteOut(
        cafe_id=cafe.id,
        cafe_name=cafe.cafe_name,
        template=site.template,
        palette=site.palette,
        custom_palette=custom_palette,

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

        loyalty_enabled=bool(loyalty_settings and loyalty_settings.enabled),
        loyalty_mode=(loyalty_settings.mode if loyalty_settings else "points"),
        loyalty_stamps_max=(loyalty_settings.stamps_max if loyalty_settings else 10),
        loyalty_stamps_earn_desc=(loyalty_settings.stamps_earn_desc if loyalty_settings else None),
        loyalty_stamps_reward_desc=(loyalty_settings.stamps_reward_desc if loyalty_settings else None),
        loyalty_rewards=(loyalty_settings.rewards if loyalty_settings and loyalty_settings.enabled else []),

        gallery_images=gallery_images,
        news_enabled=bool(news_settings and news_settings.enabled),
        news_posts=news_posts_out,
    )


@router.get("/public/by-slug/{slug}", response_model=PublicSiteOut,
            summary="Publiczna strona kawiarni po adresie (slug) — wymaga publikacji")
def get_public_site_by_slug(slug: str, db: Session = Depends(get_db)):
    cafe = db.query(Cafe).filter(Cafe.slug == slug).first()
    if not cafe:
        raise HTTPException(404, detail="Kawiarnia nie istnieje.")
    site = db.query(CafeSite).filter(CafeSite.cafe_id == cafe.id).first()
    if not site or not site.is_published:
        raise HTTPException(404, detail="Ta strona nie jest obecnie publicznie dostępna.")
    return _build_public_site(cafe, db)


@router.get("/public/{cafe_id}", response_model=PublicSiteOut,
            summary="Publiczna strona kawiarni po ID — wymaga publikacji")
def get_public_site(cafe_id: str, db: Session = Depends(get_db)):
    cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
    if not cafe:
        raise HTTPException(404, detail="Kawiarnia nie istnieje.")
    site = db.query(CafeSite).filter(CafeSite.cafe_id == cafe.id).first()
    if not site or not site.is_published:
        raise HTTPException(404, detail="Ta strona nie jest obecnie publicznie dostępna.")
    return _build_public_site(cafe, db)


@router.get("/preview/{cafe_id}", response_model=PublicSiteOut,
            summary="Podgląd strony dla właściciela — ignoruje status publikacji i subskrypcji")
def get_site_preview(cafe_id: str, token: str, db: Session = Depends(get_db)):
    payload = decode_access_token(token)
    if not payload or payload.get("sub") != cafe_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy lub wygasły token podglądu.",
        )
    cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
    if not cafe:
        raise HTTPException(404, detail="Kawiarnia nie istnieje.")
    return _build_public_site(cafe, db)