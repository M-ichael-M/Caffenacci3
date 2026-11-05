from __future__ import annotations

import json

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.cache_purge import cafe_page_urls, purge_urls
from app.core.config import settings as app_settings
from app.core.database import get_db
from app.core.languages import CURRENCIES, LANGUAGES
from app.core.page_cache import invalidate_cafe
from app.core.security import decode_access_token
from app.core.slugs import resolve_slug
from app.core.translations import (
    MAX_UPLOAD_BYTES, apply_uploaded_translation, collect_source_texts, compute_status,
    get_current_translation, get_or_create_package, get_settings, language_out,
    package_file, source_hash,
)
from app.models.cafe import Cafe
from app.models.site import CafeSite
from app.models.translation import CafeLanguageSettings, TranslationPackage
from app.routers.employee_auth import get_current_cafe_owner
from app.schemas.translation import (
    LanguageSettingsIn, LanguageSettingsOut, OptionsOut, PackageFileOut,
    PublicTranslationOut, TranslationOverviewOut,
)

router = APIRouter(tags=["translations"])


def _overview(cafe_id: str, db: Session) -> TranslationOverviewOut:
    s = get_settings(cafe_id, db)
    return TranslationOverviewOut(
        settings=LanguageSettingsOut(
            primary_language=s.primary_language, secondary_language=s.secondary_language,
            currency=s.currency, time_zone=s.time_zone,
        ),
        status=compute_status(cafe_id, s, db),
    )


# ══════════════════════════════════════════════════════════════════════════
# Panel właściciela
# ══════════════════════════════════════════════════════════════════════════

@router.get("/i18n/options", response_model=OptionsOut, summary="Dostępne języki i waluty")
def get_options():
    return OptionsOut(languages=[language_out(c) for c in LANGUAGES], currencies=list(CURRENCIES))


@router.get("/i18n/settings", response_model=TranslationOverviewOut,
            summary="Ustawienia językowe + status tłumaczenia")
def get_overview(cafe: Cafe = Depends(get_current_cafe_owner), db: Session = Depends(get_db)):
    return _overview(cafe.id, db)


@router.put("/i18n/settings", response_model=TranslationOverviewOut,
            summary="Zapisz język podstawowy, dodatkowy, walutę i strefę czasową")
def save_settings(
    payload: LanguageSettingsIn,
    cafe: Cafe = Depends(get_current_cafe_owner),
    db: Session = Depends(get_db),
):
    s = db.query(CafeLanguageSettings).filter(CafeLanguageSettings.cafe_id == cafe.id).first()
    if not s:
        s = CafeLanguageSettings(cafe_id=cafe.id)
        db.add(s)
    s.primary_language = payload.primary_language
    s.secondary_language = payload.secondary_language
    s.currency = payload.currency
    s.time_zone = payload.time_zone
    db.commit()
    invalidate_cafe(cafe.id)
    purge_urls(cafe_page_urls(cafe.slug, app_settings.PUBLIC_SITE_URL))
    return _overview(cafe.id, db)


@router.post("/i18n/packages", response_model=PackageFileOut,
             summary="Wygeneruj plik z tekstami do tłumaczenia")
def create_package(cafe: Cafe = Depends(get_current_cafe_owner), db: Session = Depends(get_db)):
    s = get_settings(cafe.id, db)
    pkg = get_or_create_package(cafe, s, db)
    return package_file(cafe, pkg, source_hash(collect_source_texts(cafe.id, db)))


@router.get("/i18n/packages/{package_id}", response_model=PackageFileOut,
            summary="Pobierz ponownie wcześniej wygenerowany plik")
def get_package(package_id: str, cafe: Cafe = Depends(get_current_cafe_owner), db: Session = Depends(get_db)):
    pkg = db.query(TranslationPackage).filter(
        TranslationPackage.id == package_id, TranslationPackage.cafe_id == cafe.id,
    ).first()
    if not pkg:
        raise HTTPException(404, detail="Paczka nie istnieje.")
    return package_file(cafe, pkg, source_hash(collect_source_texts(cafe.id, db)))


@router.post("/i18n/upload", response_model=TranslationOverviewOut,
             summary="Wgraj przetłumaczony plik")
async def upload_translation(
    file: UploadFile = File(...),
    cafe: Cafe = Depends(get_current_cafe_owner),
    db: Session = Depends(get_db),
):
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    apply_uploaded_translation(cafe.id, get_settings(cafe.id, db), raw, db)
    invalidate_cafe(cafe.id)
    purge_urls(cafe_page_urls(cafe.slug, app_settings.PUBLIC_SITE_URL))
    return _overview(cafe.id, db)


# ══════════════════════════════════════════════════════════════════════════
# Publiczne — tłumaczenia dla strony kawiarni
# ══════════════════════════════════════════════════════════════════════════
# Ścieżki pod /site/public/ dostają ETag/Cache-Control z middleware w main.py.

def _translation_response(cafe: Cafe, language: str, db: Session) -> PublicTranslationOut:
    tr = get_current_translation(cafe.id, language, db)
    if not tr:
        # Brak ALBO nieaktualne — strona ma wtedy zostać przy języku podstawowym.
        raise HTTPException(404, detail="Brak aktualnego tłumaczenia na ten język.")
    return PublicTranslationOut(
        language=language_out(language), version=tr.package_version, texts=json.loads(tr.entries),
    )


def _require_published(cafe: Cafe, db: Session) -> None:
    site = db.query(CafeSite).filter(CafeSite.cafe_id == cafe.id).first()
    if not site or not site.is_published:
        raise HTTPException(404, detail="Ta strona nie jest obecnie publicznie dostępna.")


@router.get("/site/public/by-slug/{slug}/translations/{language}", response_model=PublicTranslationOut,
            summary="Tłumaczenia strony kawiarni po slugu")
def public_translation_by_slug(slug: str, language: str, db: Session = Depends(get_db)):
    cafe, _ = resolve_slug(slug, db)
    if not cafe:
        raise HTTPException(404, detail="Kawiarnia nie istnieje.")
    _require_published(cafe, db)
    return _translation_response(cafe, language, db)


@router.get("/site/public/{cafe_id}/translations/{language}", response_model=PublicTranslationOut,
            summary="Tłumaczenia strony kawiarni po ID")
def public_translation(cafe_id: str, language: str, db: Session = Depends(get_db)):
    cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
    if not cafe:
        raise HTTPException(404, detail="Kawiarnia nie istnieje.")
    _require_published(cafe, db)
    return _translation_response(cafe, language, db)


@router.get("/site/preview/{cafe_id}/translations/{language}", response_model=PublicTranslationOut,
            summary="Tłumaczenia do podglądu właściciela (ignoruje publikację, nie ignoruje aktualności)")
def preview_translation(cafe_id: str, language: str, token: str, db: Session = Depends(get_db)):
    payload = decode_access_token(token)
    if not payload or payload.get("sub") != cafe_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Nieprawidłowy lub wygasły token podglądu.")
    cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
    if not cafe:
        raise HTTPException(404, detail="Kawiarnia nie istnieje.")
    return _translation_response(cafe, language, db)