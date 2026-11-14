from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Literal, Optional
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.languages import CURRENCIES, LANGUAGES, TIME_ZONE_RE


class LanguageOut(BaseModel):
    code: str
    name_en: str
    native_name: str
    dir: Literal["ltr", "rtl"]
    locale: str            # tag BCP-47 do Intl.DateTimeFormat / NumberFormat
    collator_locale: str   # tag do Intl.Collator (sortowanie)


class OptionsOut(BaseModel):
    languages: List[LanguageOut]
    currencies: List[str]


# â”€â”€ Ustawienia â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class LanguageSettingsIn(BaseModel):
    primary_language:   str = "pl"
    secondary_language: Optional[str] = None
    # Region (waluta/strefa) edytuje się w Profilu przez /i18n/region.
    # Tu opcjonalnie; None = bez zmian.
    currency:           Optional[str] = None
    time_zone:          Optional[str] = Field(None, max_length=64)

    @field_validator("primary_language")
    @classmethod
    def _primary(cls, v: str) -> str:
        if v not in LANGUAGES:
            raise ValueError("NieobsĹ‚ugiwany jÄ™zyk podstawowy.")
        return v

    @field_validator("secondary_language")
    @classmethod
    def _secondary(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        if v not in LANGUAGES:
            raise ValueError("NieobsĹ‚ugiwany jÄ™zyk dodatkowy.")
        return v

    @field_validator("currency")
    @classmethod
    def _currency(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.upper()
        if v not in CURRENCIES:
            raise ValueError("Nieobsługiwana waluta.")
        return v

    @field_validator("time_zone")
    @classmethod
    def _tz(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        if not TIME_ZONE_RE.match(v):
            raise ValueError("Nieprawidłowa strefa czasowa.")
        return v

    @model_validator(mode="after")
    def _different(self):
        if self.secondary_language and self.secondary_language == self.primary_language:
            raise ValueError("Język dodatkowy musi być inny niż podstawowy.")
        return self


class RegionSettingsIn(BaseModel):
    currency: str
    time_zone: str = Field(..., max_length=64)

    @field_validator("currency")
    @classmethod
    def _currency(cls, v: str) -> str:
        v = v.upper()
        if v not in CURRENCIES:
            raise ValueError("Nieobsługiwana waluta.")
        return v

    @field_validator("time_zone")
    @classmethod
    def _tz(cls, v: str) -> str:
        if not TIME_ZONE_RE.match(v):
            raise ValueError("Nieprawidłowa strefa czasowa.")
        try:
            ZoneInfo(v)
        except Exception:
            raise ValueError("Nieprawidłowa strefa czasowa.")
        return v


class RegionSettingsOut(BaseModel):
    currency: str
    time_zone: str
    confirmed: bool = True


class LanguageSettingsOut(BaseModel):
    primary_language:   str
    secondary_language: Optional[str]
    currency:           str
    time_zone:          str
    region_confirmed:   bool = True


# â”€â”€ Status tĹ‚umaczenia â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class PackageInfoOut(BaseModel):
    id: str
    version: int
    language: str
    source_language: str
    created_at: datetime
    units_count: int
    is_current: bool      # czy plik odpowiada obecnej treĹ›ci strony


class PackageFileOut(PackageInfoOut):
    filename: str
    content: str


class TranslationInfoOut(BaseModel):
    language: str
    source_language: str
    package_version: int
    uploaded_at: datetime
    units_count: int


class TranslationChangesOut(BaseModel):
    added: int
    removed: int


TranslationState = Literal["disabled", "not_generated", "awaiting_upload", "current", "stale"]


class TranslationStatusOut(BaseModel):
    state: TranslationState
    secondary_language: Optional[str] = None
    units_count: int = 0
    translation: Optional[TranslationInfoOut] = None
    latest_package: Optional[PackageInfoOut] = None
    changes: Optional[TranslationChangesOut] = None


class TranslationOverviewOut(BaseModel):
    settings: LanguageSettingsOut
    status: TranslationStatusOut


# â”€â”€ Publiczne â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class PublicI18nOut(BaseModel):
    primary: LanguageOut
    # Ustawiony TYLKO gdy istnieje aktualne tĹ‚umaczenie â€” nieaktualne nie jest wystawiane.
    secondary: Optional[LanguageOut] = None
    translation_version: Optional[int] = None
    currency: str
    time_zone: str


class PublicTranslationOut(BaseModel):
    language: LanguageOut
    version: int
    texts: Dict[str, str]   # klucz: tekst ĹşrĂłdĹ‚owy po normalizacji (patrz localeFormat.ts)
