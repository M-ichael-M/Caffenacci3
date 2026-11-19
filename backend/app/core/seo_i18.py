"""Teksty i ścieżki dla SEO-owego HTML (SSR). UI-owe napisy w aplikacji żyją w i18n/*.json —
tu tylko to, co trafia do <head> i do treści wstrzykiwanej przez backend."""
from __future__ import annotations

SITE_LANGS = ("pl", "en")


def site_lang(code: str | None) -> str:
    """Język listingów/strony głównej: pl albo en (reszta świata -> en)."""
    return "pl" if code == "pl" else "en"


# ── Ścieżki (jedno źródło prawdy; lustro: caffenacci.customer/src/utils/sitePaths.ts) ──

def home_path(lang: str) -> str:
    return "/" if site_lang(lang) == "pl" else "/en/"


def city_path(lang: str, city_slug: str) -> str:
    return f"/kawiarnie/{city_slug}" if site_lang(lang) == "pl" else f"/en/cafes/{city_slug}"


def badge_slug(key: str) -> str:
    return key.replace("_", "-")


def badge_path(lang: str, city_slug: str, key: str) -> str:
    return f"{city_path(lang, city_slug)}/{badge_slug(key)}"


# ── Plakietki: etykiety do SSR (klucze = ALLOWED_BADGE_KEYS; kolejność = katalog z frontu) ──

BADGE_LABELS: dict[str, dict[str, str]] = {
    "pet_friendly":     {"pl": "Przyjazna zwierzętom", "en": "Pet friendly"},
    "animal_cafe":      {"pl": "Zwierzęca kawiarnia", "en": "Animal café"},
    "family_friendly":  {"pl": "Dla rodzin", "en": "Family friendly"},
    "work_friendly":    {"pl": "Idealna do pracy", "en": "Good for working"},
    "date_spot":        {"pl": "Na randkę", "en": "Date spot"},
    "free_wifi":        {"pl": "Darmowe wifi", "en": "Free Wi-Fi"},
    "board_games":      {"pl": "Planszówki", "en": "Board games"},
    "video_games":      {"pl": "Gry wideo", "en": "Video games"},
    "power_outlets":    {"pl": "Gniazdka przy stolikach", "en": "Power outlets at tables"},
    "specialty_coffee": {"pl": "Specialty coffee", "en": "Specialty coffee"},
    "fast_service":     {"pl": "Szybkie zamówienia", "en": "Fast orders"},
    "live_music":       {"pl": "Muzyka na żywo", "en": "Live music"},
    "extra_activities": {"pl": "Dodatkowe aktywności", "en": "Extra activities"},
    "karaoke":          {"pl": "Karaoke", "en": "Karaoke"},
    "bookshelf":        {"pl": "Półka z książkami", "en": "Bookshelf"},
    "garden":           {"pl": "Ogródek", "en": "Garden"},
    "air_conditioning": {"pl": "Klimatyzacja", "en": "Air conditioning"},
    "accessible":       {"pl": "Przyjazna osobom z niepełnosprawnościami", "en": "Wheelchair accessible"},
    "parking":          {"pl": "Parking", "en": "Parking"},
    "bike_rack":        {"pl": "Stojak na rowery", "en": "Bike rack"},
    "adults_only":      {"pl": "18+", "en": "18+"},
}


def badge_label(key: str, lang: str) -> str:
    entry = BADGE_LABELS.get(key, {})
    return entry.get(site_lang(lang)) or entry.get("en") or key


# ── Słowniki napisów ────────────────────────────────────────────────────────

UI: dict[str, dict] = {
    "pl": {
        "crumb_home": "Caffenacci",
        "days": ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"],
        "closed": "Zamknięte",
        "h_hours": "Godziny otwarcia", "h_menu": "Menu", "h_reviews": "Opinie gości",
        "h_nearby": "Inne kawiarnie w mieście {city}",
        "phone": "Telefon", "email": "E-mail",
        "rating_line": "Średnia ocena {avg}/5 ({count})",
        "city_link": "Wszystkie kawiarnie – {city}",
        "title_cafe": "{name} – kawiarnia {city}, {street} {no} | Caffenacci",
        "desc_default": "{name} – kawiarnia w {city}, {street} {no}. Menu, godziny otwarcia i opinie gości.",
        # strona główna
        "home_title": "Caffenacci – wyszukiwarka kawiarni | Menu, godziny otwarcia, opinie",
        "home_desc": "Znajdź kawiarnię w swoim mieście: menu, godziny otwarcia, opinie gości, rezerwacje stolików "
                     "i zamówienia online. Wyszukiwarka kawiarni Caffenacci.",
        "home_h1": "Wyszukiwarka kawiarni Caffenacci",
        "home_intro": [
            "Caffenacci to wyszukiwarka kawiarni: menu, godziny otwarcia, opinie gości, rezerwacje stolików, "
            "zamówienia online i programy lojalnościowe w jednym miejscu.",
            "Wybierz miasto albo wyszukaj kawiarnię po nazwie, ulicy lub kodzie pocztowym.",
        ],
        "h_cities": "Kawiarnie według miast", "h_popular": "Polecane kawiarnie",
        # miasto / plakietka
        "city_title": "Kawiarnie {city} – lista, menu i opinie | Caffenacci",
        "city_desc": "Kawiarnie w mieście {city}: menu, godziny otwarcia, opinie gości, rezerwacje i zamówienia online.",
        "city_h1": "Kawiarnie – {city}",
        "city_intro": "Lista kawiarni w mieście {city}: menu, godziny otwarcia, opinie gości, rezerwacje stolików i zamówienia online.",
        "count_line": "Liczba kawiarni: {count}.",
        "badge_title": "Kawiarnie {city} – {badge} | Caffenacci",
        "badge_desc": "Kawiarnie w mieście {city}: {badge}. Menu, godziny otwarcia i opinie gości.",
        "badge_h1": "Kawiarnie – {city}: {badge}",
        "badge_intro": "Kawiarnie w mieście {city} z udogodnieniem: {badge}.",
        "h_filters": "Kawiarnie według udogodnień", "h_cafes": "Lista kawiarni",
        "h_other_cities": "Inne miasta", "h_other_badges": "Inne udogodnienia",
    },
    "en": {
        "crumb_home": "Caffenacci",
        "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        "closed": "Closed",
        "h_hours": "Opening hours", "h_menu": "Menu", "h_reviews": "Guest reviews",
        "h_nearby": "More cafés in {city}",
        "phone": "Phone", "email": "Email",
        "rating_line": "Average rating {avg}/5 ({count})",
        "city_link": "All cafés – {city}",
        "title_cafe": "{name} – café in {city}, {street} {no} | Caffenacci",
        "desc_default": "{name} – café in {city}, {street} {no}. Menu, opening hours and guest reviews.",
        "home_title": "Caffenacci – café finder | Menus, opening hours, reviews",
        "home_desc": "Find a café in your city: menus, opening hours, guest reviews, table reservations "
                     "and online orders. Caffenacci café finder.",
        "home_h1": "Caffenacci café finder",
        "home_intro": [
            "Caffenacci is a café finder: menus, opening hours, guest reviews, table reservations, "
            "online orders and loyalty programmes in one place.",
            "Pick a city or search for a café by name, street or postcode.",
        ],
        "h_cities": "Cafés by city", "h_popular": "Featured cafés",
        "city_title": "Cafés in {city} – list, menus and reviews | Caffenacci",
        "city_desc": "Cafés in {city}: menus, opening hours, guest reviews, reservations and online orders.",
        "city_h1": "Cafés in {city}",
        "city_intro": "A list of cafés in {city}: menus, opening hours, guest reviews, table reservations and online orders.",
        "count_line": "Number of cafés: {count}.",
        "badge_title": "Cafés in {city} – {badge} | Caffenacci",
        "badge_desc": "Cafés in {city}: {badge}. Menus, opening hours and guest reviews.",
        "badge_h1": "Cafés in {city}: {badge}",
        "badge_intro": "Cafés in {city} with this amenity: {badge}.",
        "h_filters": "Cafés by amenity", "h_cafes": "List of cafés",
        "h_other_cities": "Other cities", "h_other_badges": "Other amenities",
    },
}


def ui(lang: str | None) -> dict:
    return UI.get(lang or "") or UI["en"]