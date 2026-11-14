"""Rozliczenia z Caffenacci: stały cennik per waluta (bez przeliczania kursem)
i domyślna waluta rozliczeń wyliczana z kraju kawiarni."""
from __future__ import annotations

import unicodedata

# Kwoty w jednostkach podrzędnych (grosze / centy). Wszystkie trzy waluty mają wykładnik 2.
# Docelowo każdy wpis dostanie tu też identyfikator ceny Stripe.
BILLING_PRICES_MINOR: dict[str, int] = {"PLN": 2000, "EUR": 500, "USD": 500}
BILLING_CURRENCIES = tuple(BILLING_PRICES_MINOR)
DEFAULT_BILLING_CURRENCY = "USD"

_POLAND = {"polska", "poland", "polen", "pl"}

_EURO_ZONE = {
    "austria", "osterreich", "belgia", "belgium", "belgique", "belgie",
    "bulgaria", "bulgaria", "chorwacja", "croatia", "hrvatska",
    "cypr", "cyprus", "kypros", "estonia", "eesti", "finlandia", "finland", "suomi",
    "francja", "france", "niemcy", "germany", "deutschland", "grecja", "greece", "ellada",
    "irlandia", "ireland", "eire", "wlochy", "italy", "italia",
    "lotwa", "latvia", "latvija", "litwa", "lithuania", "lietuva",
    "luksemburg", "luxembourg", "malta", "holandia", "niderlandy", "netherlands",
    "the netherlands", "nederland", "portugalia", "portugal",
    "slowacja", "slovakia", "slovensko", "slowenia", "slovenia", "slovenija",
    "hiszpania", "spain", "espana",
}


def _norm(s: str | None) -> str:
    s = (s or "").translate(str.maketrans({"ł": "l", "Ł": "l"}))
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c)).strip().lower()


def default_billing_currency(country: str | None) -> str:
    """PL → PLN, strefa euro → EUR, reszta → USD."""
    c = _norm(country)
    if c in _POLAND:
        return "PLN"
    if c in _EURO_ZONE:
        return "EUR"
    return DEFAULT_BILLING_CURRENCY