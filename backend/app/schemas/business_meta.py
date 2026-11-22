from __future__ import annotations
import json
import re

# Klucze zsynchronizowane z katalogami na froncie (etykiety w panelu).
# Etykiety SSR (pl/en) żyją w app/core/seo_i18.py.
ALLOWED_PRICE_RANGES = ("$", "$$", "$$$", "$$$$")
ALLOWED_CUISINE_KEYS = (
    "specialty_coffee", "breakfast", "brunch", "pastries",
    "desserts", "lunch", "vegan", "tea",
)
ALLOWED_PAYMENT_KEYS = ("cash", "card", "contactless", "blik", "mobile_wallet")

GOOGLE_PLACE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{10,255}$")   # np. ChIJ...
GOOGLE_CID_RE = re.compile(r"^\d{5,20}$")                      # CID = liczba 64-bit bez znaku


def google_maps_url(cid: str | None, place_id: str | None) -> str | None:
    """Jednoznaczny link do wizytówki. CID ma pierwszeństwo (stały, krótki)."""
    if cid:
        return f"https://www.google.com/maps?cid={cid}"
    if place_id:
        return f"https://www.google.com/maps/search/?api=1&query=Google&query_place_id={place_id}"
    return None


def dump_keys(keys: list[str] | None) -> str | None:
    return json.dumps(list(keys), ensure_ascii=False) if keys else None


def load_keys(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return []
    return [k for k in data if isinstance(k, str)] if isinstance(data, list) else []