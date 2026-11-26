from __future__ import annotations

from datetime import date

from fastapi import HTTPException

DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"
LIST_LIMIT = 500          # twardy sufit dla list panelu
MAX_RANGE_DAYS = 93


def check_date_range(date_from: str | None, date_to: str | None) -> None:
    parsed = []
    for v in (date_from, date_to):
        if v is None:
            continue
        try:
            parsed.append(date.fromisoformat(v))
        except ValueError:
            raise HTTPException(400, detail="Nieprawidłowa data.")
    if len(parsed) == 2:
        if parsed[1] < parsed[0]:
            raise HTTPException(400, detail="Data początkowa jest późniejsza niż końcowa.")
        if (parsed[1] - parsed[0]).days > MAX_RANGE_DAYS:
            raise HTTPException(400, detail="Zakres dat jest zbyt duży.")


def fetch_page(query, limit: int, offset: int = 0):
    """Pobiera limit+1 wierszy, żeby wiedzieć, czy jest więcej — bez COUNT(*)."""
    rows = query.offset(offset).limit(limit + 1).all()
    return rows[:limit], len(rows) > limit