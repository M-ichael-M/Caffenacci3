"""Reguła naliczania punktów: „za każde N [waluta kawiarni] klient dostaje P punktów”."""
from __future__ import annotations

from decimal import Decimal

from app.core.currency import round_decimal

DEFAULT_POINTS = 30

# Domyślne N dla nowych programów (kwota w walucie kawiarni). Reszta: 1.
DEFAULT_UNIT_BY_CURRENCY: dict[str, int] = {
    "JPY": 100, "KRW": 100, "ISK": 100, "CLP": 100, "HUF": 100,
    "VND": 10_000, "IDR": 10_000,
}


def default_unit(code: str | None) -> int:
    return DEFAULT_UNIT_BY_CURRENCY.get((code or "").upper(), 1)


def compute_points(amount, currency: str | None, points: int, unit: int) -> int:
    """floor(kwota * P / N) na Decimal. Kwota jest najpierw zaokrąglana wg wykładnika waluty."""
    amt = round_decimal(amount, currency)
    return int((amt * points) // Decimal(unit))