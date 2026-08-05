from __future__ import annotations

# ── Katalog plakietek ──────────────────────────────────────────────────────
# Klucze muszą być zsynchronizowane z katalogami plakietek na froncie:
#   caffenacci.company/src/badges.ts   (wybór przez właściciela w Profilu)
#   caffenacci.customer/src/badges.ts  (wyświetlanie klientom w wynikach)
# Etykiety, ikony i opisy żyją WYŁĄCZNIE na froncie — backend zna tylko
# zbiór dozwolonych kluczy, do walidacji przy zapisie profilu.

ALLOWED_BADGE_KEYS = {
    "pet_friendly",
    "animal_cafe",
    "family_friendly",
    "work_friendly",
    "date_spot",
    "free_wifi",
    "board_games",
    "video_games",
    "power_outlets",
    "specialty_coffee",
    "fast_service",
    "live_music",
    "extra_activities",
    "karaoke",
    "bookshelf",
    "garden",
    "air_conditioning",
    "accessible",
    "parking",
    "bike_rack",
    "adults_only",
}

# Ile plakietek właściciel może wyróżnić jednocześnie — wyróżnione plakietki
# pojawiają się w kafelku kawiarni w wynikach wyszukiwania (cafe_search.py).
MAX_FEATURED_BADGES = 3
