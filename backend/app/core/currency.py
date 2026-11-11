"""Waluta kawiarni: wykładnik ISO 4217, zaokrąglanie kwot, odczyt z ustawień.

Tabela wykładników MUSI być identyczna z caffenacci.*/src/utils/currency.ts."""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable

from sqlalchemy.orm import Session

from app.core.languages import DEFAULT_CURRENCY
from app.models.translation import CafeLanguageSettings

# Domyślnie 2 miejsca po przecinku; tu tylko waluty bez podjednostki.
EXPONENT_OVERRIDES: dict[str, int] = {"ISK": 0, "JPY": 0, "KRW": 0, "VND": 0, "CLP": 0}


def currency_exponent(code: str | None) -> int:
    return EXPONENT_OVERRIDES.get((code or "").upper(), 2)


def round_decimal(value, code: str | None) -> Decimal:
    q = Decimal(1).scaleb(-currency_exponent(code))       # 0.01 albo 1
    return Decimal(str(value)).quantize(q, rounding=ROUND_HALF_UP)


def round_money(value, code: str | None) -> float:
    return float(round_decimal(value, code))


def cafe_currency(cafe_id: str, db: Session) -> str:
    row = db.query(CafeLanguageSettings.currency).filter(
        CafeLanguageSettings.cafe_id == cafe_id).first()
    return row[0] if row and row[0] else DEFAULT_CURRENCY


def cafe_currencies(cafe_ids: Iterable[str], db: Session) -> dict[str, str]:
    ids = list(set(cafe_ids))
    found = dict(
        db.query(CafeLanguageSettings.cafe_id, CafeLanguageSettings.currency)
        .filter(CafeLanguageSettings.cafe_id.in_(ids)).all()
    ) if ids else {}
    return {cid: found.get(cid) or DEFAULT_CURRENCY for cid in ids}