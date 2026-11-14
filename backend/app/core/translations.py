"""Teksty do tłumaczenia, format pliku, parser, wersjonowanie i status.

Format pliku — każdy tekst ma znacznik złożony WYŁĄCZNIE z cyfr i nawiasów:

    [[[0000]]]
    482910357712          <- token paczki (same cyfry)

    [[[0001]]]
    kawa czarna

Znacznik nie zawiera liter, więc tłumacz (Google/DeepL) nie ma czego tłumaczyć,
a parser jest tolerancyjny: rozpoznaje cyfry arabskie/pełnoszerokie, zmienione
lub odwrócone (RTL) nawiasy i dodatkowe spacje.
"""
from __future__ import annotations

import hashlib
import json
import re
import secrets
import unicodedata
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.core.languages import (
    DEFAULT_CURRENCY, DEFAULT_PRIMARY_LANGUAGE, DEFAULT_TIME_ZONE, get_language,
)
from app.models.cafe_profile import CafeProfile
from app.models.loyalty import LoyaltySettings
from app.models.menu import MenuSection
from app.models.news import NewsPost, NewsSettings
from app.models.reservation import ReservationSettings
from app.models.translation import CafeLanguageSettings, CafeTranslation, TranslationPackage
from app.schemas.translation import (
    LanguageOut, PackageFileOut, PackageInfoOut, PublicI18nOut,
    TranslationChangesOut, TranslationInfoOut, TranslationStatusOut,
)

META_ID = 0
KEEP_PACKAGES = 5
MAX_UPLOAD_BYTES = 2 * 1024 * 1024

_LETTER = re.compile(r"[^\W\d_]")
_DIGITS = re.compile(r"\d+")
_NOT_DECORATION = re.compile(r"[\d\s]")


# ══════════════════════════════════════════════════════════════════════════
# Ustawienia / języki
# ══════════════════════════════════════════════════════════════════════════

def get_settings(cafe_id: str, db: Session) -> CafeLanguageSettings:
    s = db.query(CafeLanguageSettings).filter(CafeLanguageSettings.cafe_id == cafe_id).first()
    return s or CafeLanguageSettings(
        cafe_id=cafe_id, primary_language=DEFAULT_PRIMARY_LANGUAGE, secondary_language=None,
        currency=DEFAULT_CURRENCY, time_zone=DEFAULT_TIME_ZONE, region_confirmed=False,
    )


def language_out(code: str) -> LanguageOut:
    lang = get_language(code)
    return LanguageOut(
        code=lang.code, name_en=lang.name_en, native_name=lang.native,
        dir=lang.direction, locale=lang.locale, collator_locale=lang.collator_locale,
    )


# ══════════════════════════════════════════════════════════════════════════
# Zbieranie tekstów źródłowych
# ══════════════════════════════════════════════════════════════════════════

def normalize_text(value: str) -> str:
    """Ta sama normalizacja musi działać po stronie strony klienta
    (patrz translateText w localeFormat.ts)."""
    v = unicodedata.normalize("NFC", value.replace("\r\n", "\n").replace("\r", "\n"))
    return v.strip()


def collect_source_texts(cafe_id: str, db: Session) -> list[str]:
    """Unikalne teksty kawiarni widoczne publicznie, w kolejności pojawiania się.
    Pomijamy: nazwę kawiarni, adres, ceny, imiona (nie podlegają tłumaczeniu)
    oraz teksty bez liter (np. „24/7”). Ukryte treści nie trafiają do pliku."""
    texts: list[str] = []
    seen: set[str] = set()

    def add(value: str | None) -> None:
        if not value:
            return
        t = normalize_text(value)
        if t and t not in seen and _LETTER.search(t):
            seen.add(t)
            texts.append(t)

    profile = (
        db.query(CafeProfile)
        .options(selectinload(CafeProfile.employees), selectinload(CafeProfile.social_links))
        .filter(CafeProfile.cafe_id == cafe_id)
        .first()
    )
    if profile and profile.description_visible:
        add(profile.description)

    sections = (
        db.query(MenuSection)
        .options(selectinload(MenuSection.items))
        .filter(MenuSection.cafe_id == cafe_id)
        .order_by(MenuSection.position)
        .all()
    )
    for sec in sections:
        add(sec.name)
        for it in sec.items:
            add(it.name)
            add(it.description)

    loyalty = (
        db.query(LoyaltySettings)
        .options(selectinload(LoyaltySettings.rewards))
        .filter(LoyaltySettings.cafe_id == cafe_id)
        .first()
    )
    if loyalty and loyalty.enabled:
        if loyalty.mode == "stamps":
            add(loyalty.stamps_earn_desc)
            add(loyalty.stamps_reward_desc)
        else:
            for r in loyalty.rewards:
                add(r.name)

    news_settings = db.query(NewsSettings).filter(NewsSettings.cafe_id == cafe_id).first()
    if news_settings and news_settings.enabled:
        posts = (
            db.query(NewsPost).filter(NewsPost.cafe_id == cafe_id)
            .order_by(NewsPost.created_at.desc()).limit(3).all()   # tyle pokazuje strona
        )
        for p in posts:
            add(p.title)
            add(p.content)

    if profile:
        for e in profile.employees:
            if e.visible:
                add(e.role)
                add(e.bio)
        for s in profile.social_links:
            if s.visible and s.platform == "other":
                add(s.label)

    res = (
        db.query(ReservationSettings)
        .options(selectinload(ReservationSettings.tables))
        .filter(ReservationSettings.cafe_id == cafe_id)
        .first()
    )
    if res and res.enabled and res.mode == "advanced":
        for t in res.tables:
            add(t.label)

    return texts


def source_hash(texts: list[str]) -> str:
    """Hash ZBIORU tekstów (kolejność pozycji menu i ceny go nie zmieniają)."""
    return hashlib.sha256("\x1f".join(sorted(texts)).encode("utf-8")).hexdigest()


# ══════════════════════════════════════════════════════════════════════════
# Format pliku
# ══════════════════════════════════════════════════════════════════════════

def _marker(n: int) -> str:
    return f"[[[{n:04d}]]]"


def marker_id(line: str) -> int | None:
    """Zwraca numer znacznika, jeśli linia wygląda jak znacznik (po ewentualnym
    „uszkodzeniu” przez tłumacza), inaczej None. Znacznik: brak liter, dokładnie
    jeden ciąg cyfr (Unicode), co najmniej 4 znaki ozdobne."""
    s = line.strip()
    if len(s) < 5 or _LETTER.search(s):
        return None
    runs = _DIGITS.findall(s)
    if len(runs) != 1:
        return None
    if len(_NOT_DECORATION.sub("", s)) < 4:
        return None
    try:
        return int(runs[0])        # int() rozumie cyfry arabskie, pełnoszerokie itd.
    except ValueError:
        return None


def render_package(texts: list[str], token: int) -> str:
    parts = [f"{_marker(META_ID)}\n{token:012d}"]
    for i, text in enumerate(texts, 1):
        # Linia treści wyglądająca jak znacznik (praktycznie nie występuje) — rozbrajamy.
        safe = "\n".join("· " + ln if marker_id(ln) is not None else ln for ln in text.split("\n"))
        parts.append(f"{_marker(i)}\n{safe}")
    return "\n\n".join(parts) + "\n"


def parse_translation_file(text: str) -> dict[int, str]:
    result: dict[int, str] = {}
    current: int | None = None
    buf: list[str] = []

    def flush() -> None:
        if current is None:
            return
        if current in result:
            raise HTTPException(400, detail=f"Znacznik {_marker(current)} występuje w pliku więcej niż raz.")
        result[current] = "\n".join(buf).strip()

    for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        mid = marker_id(line)
        if mid is not None:
            flush()
            current, buf = mid, []
        elif current is not None:
            buf.append(line)
    flush()
    return result


def decode_upload(raw: bytes) -> str:
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):        # UTF-16 z Worda / Notatnika
        return raw.decode("utf-16")
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(400, detail="Plik musi być zapisany w kodowaniu UTF-8.")


def package_filename(cafe, pkg: TranslationPackage) -> str:
    base = re.sub(r"[^a-z0-9-]", "", (cafe.slug or "kawiarnia").lower()) or "kawiarnia"
    return f"caffenacci-{base}-{pkg.source_language}-{pkg.target_language}-v{pkg.version}.txt"


# ══════════════════════════════════════════════════════════════════════════
# Paczki
# ══════════════════════════════════════════════════════════════════════════

def get_or_create_package(cafe, s: CafeLanguageSettings, db: Session) -> TranslationPackage:
    if not s.secondary_language:
        raise HTTPException(400, detail="Najpierw wybierz język dodatkowy i zapisz ustawienia.")

    texts = collect_source_texts(cafe.id, db)
    if not texts:
        raise HTTPException(
            400, detail="Nie ma jeszcze żadnych tekstów do przetłumaczenia — uzupełnij menu, opis lub inne treści strony.",
        )
    h = source_hash(texts)

    base_q = db.query(TranslationPackage).filter(
        TranslationPackage.cafe_id == cafe.id,
        TranslationPackage.target_language == s.secondary_language,
    )
    latest = (
        base_q.filter(TranslationPackage.source_language == s.primary_language)
        .order_by(TranslationPackage.version.desc()).first()
    )
    if latest and latest.source_hash == h:
        return latest                      # nic się nie zmieniło — ten sam plik, ta sama wersja

    max_version = db.query(func.max(TranslationPackage.version)).filter(
        TranslationPackage.cafe_id == cafe.id,
        TranslationPackage.target_language == s.secondary_language,
    ).scalar() or 0

    while True:
        token = secrets.randbelow(9 * 10**11) + 10**11          # 12 cyfr, bez zer wiodących
        if not db.query(TranslationPackage.id).filter(TranslationPackage.token == token).first():
            break

    pkg = TranslationPackage(
        cafe_id=cafe.id,
        source_language=s.primary_language,
        target_language=s.secondary_language,
        version=max_version + 1,
        token=token,
        source_hash=h,
        texts=json.dumps(texts, ensure_ascii=False),
    )
    db.add(pkg)
    db.flush()

    for old in base_q.order_by(TranslationPackage.version.desc()).offset(KEEP_PACKAGES).all():
        db.delete(old)
    db.commit()
    db.refresh(pkg)
    return pkg


def package_info(pkg: TranslationPackage, current_hash: str) -> PackageInfoOut:
    return PackageInfoOut(
        id=pkg.id, version=pkg.version, language=pkg.target_language,
        source_language=pkg.source_language, created_at=pkg.created_at,
        units_count=len(json.loads(pkg.texts)),
        is_current=pkg.source_hash == current_hash,
    )


def package_file(cafe, pkg: TranslationPackage, current_hash: str) -> PackageFileOut:
    info = package_info(pkg, current_hash)
    return PackageFileOut(
        **info.model_dump(),
        filename=package_filename(cafe, pkg),
        content=render_package(json.loads(pkg.texts), pkg.token),
    )


# ══════════════════════════════════════════════════════════════════════════
# Wgranie tłumaczenia
# ══════════════════════════════════════════════════════════════════════════

def apply_uploaded_translation(cafe_id: str, s: CafeLanguageSettings, raw: bytes, db: Session) -> None:
    if not s.secondary_language:
        raise HTTPException(400, detail="Najpierw wybierz język dodatkowy.")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, detail="Plik jest za duży (maks. 2 MB).")

    parsed = parse_translation_file(decode_upload(raw))

    digits = re.sub(r"\D", "", parsed.get(META_ID, ""))
    if not digits:
        raise HTTPException(
            400,
            detail="Nie znaleziono w pliku identyfikatora wersji. Wgraj plik wygenerowany w Caffenacci "
                   "i nie usuwaj z niego linii ze znacznikami [[[…]]].",
        )
    pkg = db.query(TranslationPackage).filter(
        TranslationPackage.cafe_id == cafe_id, TranslationPackage.token == int(digits),
    ).first()
    if not pkg:
        raise HTTPException(400, detail="Nie rozpoznano pliku — wygeneruj nowy plik w panelu i przetłumacz go.")

    if pkg.target_language != s.secondary_language or pkg.source_language != s.primary_language:
        raise HTTPException(
            409, detail="Ten plik został wygenerowany dla innej pary języków niż obecnie wybrana. Wygeneruj nowy plik.",
        )

    texts: list[str] = json.loads(pkg.texts)
    if source_hash(collect_source_texts(cafe_id, db)) != pkg.source_hash:
        raise HTTPException(
            409, detail="Treść strony zmieniła się po wygenerowaniu tego pliku. Wygeneruj nowy plik, przetłumacz go i wgraj ponownie.",
        )

    missing = [i for i in range(1, len(texts) + 1) if not parsed.get(i)]
    if missing:
        shown = ", ".join(_marker(i) for i in missing[:5]) + (" …" if len(missing) > 5 else "")
        raise HTTPException(
            400,
            detail=f"W pliku brakuje tłumaczeń dla {len(missing)} z {len(texts)} tekstów ({shown}). "
                   "Przetłumacz cały plik i nie usuwaj linii ze znacznikami.",
        )

    entries = {text: parsed[i] for i, text in enumerate(texts, 1)}

    tr = db.query(CafeTranslation).filter(
        CafeTranslation.cafe_id == cafe_id, CafeTranslation.target_language == pkg.target_language,
    ).first()
    if not tr:
        tr = CafeTranslation(cafe_id=cafe_id, target_language=pkg.target_language)
        db.add(tr)
    tr.source_language = pkg.source_language
    tr.package_id = pkg.id
    tr.package_version = pkg.version
    tr.source_hash = pkg.source_hash
    tr.entries = json.dumps(entries, ensure_ascii=False)
    tr.uploaded_at = datetime.utcnow()
    db.commit()


# ══════════════════════════════════════════════════════════════════════════
# Status i dostęp publiczny
# ══════════════════════════════════════════════════════════════════════════

def _stored_translation(cafe_id: str, s: CafeLanguageSettings, db: Session) -> CafeTranslation | None:
    if not s.secondary_language:
        return None
    return db.query(CafeTranslation).filter(
        CafeTranslation.cafe_id == cafe_id,
        CafeTranslation.target_language == s.secondary_language,
        CafeTranslation.source_language == s.primary_language,
    ).first()


def get_current_translation(cafe_id: str, language: str, db: Session) -> CafeTranslation | None:
    """Tłumaczenie wolno pokazać na stronie TYLKO gdy jest drugim językiem kawiarni
    i jego hash zgadza się z obecną treścią. Nieaktualne → None."""
    s = get_settings(cafe_id, db)
    if not s.secondary_language or s.secondary_language != language:
        return None
    tr = _stored_translation(cafe_id, s, db)
    if tr and tr.source_hash == source_hash(collect_source_texts(cafe_id, db)):
        return tr
    return None


def compute_status(cafe_id: str, s: CafeLanguageSettings, db: Session) -> TranslationStatusOut:
    if not s.secondary_language:
        return TranslationStatusOut(state="disabled")

    texts = collect_source_texts(cafe_id, db)
    h = source_hash(texts)

    pkg = (
        db.query(TranslationPackage)
        .filter(
            TranslationPackage.cafe_id == cafe_id,
            TranslationPackage.target_language == s.secondary_language,
            TranslationPackage.source_language == s.primary_language,
        )
        .order_by(TranslationPackage.version.desc()).first()
    )
    pkg_out = package_info(pkg, h) if pkg else None

    tr = _stored_translation(cafe_id, s, db)
    translation = changes = None
    if tr:
        entries = json.loads(tr.entries)
        translation = TranslationInfoOut(
            language=tr.target_language, source_language=tr.source_language,
            package_version=tr.package_version, uploaded_at=tr.uploaded_at, units_count=len(entries),
        )
        if tr.source_hash == h:
            state = "current"
        else:
            state = "stale"
            old, new = set(entries), set(texts)
            changes = TranslationChangesOut(added=len(new - old), removed=len(old - new))
    elif pkg_out and pkg_out.is_current:
        state = "awaiting_upload"
    else:
        state = "not_generated"

    return TranslationStatusOut(
        state=state, secondary_language=s.secondary_language, units_count=len(texts),
        translation=translation, latest_package=pkg_out, changes=changes,
    )


def build_public_i18n(cafe_id: str, db: Session) -> PublicI18nOut:
    s = get_settings(cafe_id, db)
    secondary = version = None
    if s.secondary_language:
        tr = get_current_translation(cafe_id, s.secondary_language, db)
        if tr:
            secondary, version = language_out(s.secondary_language), tr.package_version
    return PublicI18nOut(
        primary=language_out(s.primary_language), secondary=secondary,
        translation_version=version, currency=s.currency, time_zone=s.time_zone,
    )
