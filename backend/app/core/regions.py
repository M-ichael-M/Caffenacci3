"""Domyślna waluta i strefa czasowa nowej kawiarni — wyliczane z kraju i strefy przeglądarki."""
from __future__ import annotations

from zoneinfo import ZoneInfo

from app.core.billing_prices import _EURO_ZONE, _POLAND, _norm
from app.core.languages import DEFAULT_TIME_ZONE, TIME_ZONE_RE

DEFAULT_COUNTRY_CURRENCY = "USD"

# Klucze znormalizowane przez _norm (małe litery, bez diakrytyków); polskie i angielskie nazwy.
_BY_COUNTRY: dict[str, str] = {
    **dict.fromkeys(("wielka brytania", "united kingdom", "uk", "anglia", "england"), "GBP"),
    **dict.fromkeys(("stany zjednoczone", "united states", "usa", "stany zjednoczone ameryki"), "USD"),
    **dict.fromkeys(("szwajcaria", "switzerland", "schweiz"), "CHF"),
    **dict.fromkeys(("czechy", "czechia", "czech republic"), "CZK"),
    **dict.fromkeys(("szwecja", "sweden", "sverige"), "SEK"),
    **dict.fromkeys(("norwegia", "norway", "norge"), "NOK"),
    **dict.fromkeys(("dania", "denmark", "danmark"), "DKK"),
    **dict.fromkeys(("wegry", "hungary", "magyarorszag"), "HUF"),
    **dict.fromkeys(("rumunia", "romania"), "RON"),
    **dict.fromkeys(("islandia", "iceland"), "ISK"),
    **dict.fromkeys(("ukraina", "ukraine"), "UAH"),
    **dict.fromkeys(("turcja", "turkey", "turkiye"), "TRY"),
    **dict.fromkeys(("kanada", "canada"), "CAD"),
    **dict.fromkeys(("australia",), "AUD"),
    **dict.fromkeys(("nowa zelandia", "new zealand"), "NZD"),
    **dict.fromkeys(("japonia", "japan"), "JPY"),
    **dict.fromkeys(("chiny", "china"), "CNY"),
    **dict.fromkeys(("hongkong", "hong kong"), "HKD"),
    **dict.fromkeys(("korea poludniowa", "south korea", "korea"), "KRW"),
    **dict.fromkeys(("indie", "india"), "INR"),
    **dict.fromkeys(("singapur", "singapore"), "SGD"),
    **dict.fromkeys(("tajlandia", "thailand"), "THB"),
    **dict.fromkeys(("kambodza", "cambodia"), "KHR"),
    **dict.fromkeys(("malezja", "malaysia"), "MYR"),
    **dict.fromkeys(("indonezja", "indonesia"), "IDR"),
    **dict.fromkeys(("wietnam", "vietnam"), "VND"),
    **dict.fromkeys(("filipiny", "philippines"), "PHP"),
    **dict.fromkeys(("zjednoczone emiraty arabskie", "united arab emirates", "uae"), "AED"),
    **dict.fromkeys(("arabia saudyjska", "saudi arabia"), "SAR"),
    **dict.fromkeys(("izrael", "israel"), "ILS"),
    **dict.fromkeys(("egipt", "egypt"), "EGP"),
    **dict.fromkeys(("republika poludniowej afryki", "south africa", "rpa"), "ZAR"),
    **dict.fromkeys(("meksyk", "mexico"), "MXN"),
    **dict.fromkeys(("brazylia", "brazil", "brasil"), "BRL"),
    **dict.fromkeys(("argentyna", "argentina"), "ARS"),
    **dict.fromkeys(("chile",), "CLP"),
    **dict.fromkeys(("kolumbia", "colombia"), "COP"),
}


def currency_for_country(country: str | None) -> str:
    c = _norm(country)
    if c in _POLAND:
        return "PLN"
    if c in _EURO_ZONE:
        return "EUR"
    return _BY_COUNTRY.get(c, DEFAULT_COUNTRY_CURRENCY)


def valid_time_zone(name: str | None) -> str:
    """Strefa z przeglądarki, jeśli jest poprawną nazwą IANA; inaczej domyślna."""
    if name and TIME_ZONE_RE.match(name):
        try:
            ZoneInfo(name)
            return name
        except Exception:
            pass
    return DEFAULT_TIME_ZONE
