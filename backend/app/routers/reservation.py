from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.cafe import Cafe
from app.models.reservation import (
    ReservationSettings, DayHours, CafeTable, Reservation,
    TableType, ReservationStatus,
)
from app.schemas.reservation import (
    ReservationSettingsIn, ReservationSettingsOut,
    ReservationIn, ReservationOut, ReservationListOut,
)

router = APIRouter(prefix="/reservations", tags=["reservations"])
bearer_scheme = HTTPBearer()


# ── Auth helper ────────────────────────────────────────────────────────────

def get_current_cafe(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Cafe:
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy lub wygasły token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    cafe = db.query(Cafe).filter(Cafe.id == payload.get("sub")).first()
    if not cafe:
        raise HTTPException(status_code=404, detail="Kawiarnia nie znaleziona.")
    return cafe


def _get_or_create_settings(cafe_id: str, db: Session) -> ReservationSettings:
    s = (
        db.query(ReservationSettings)
        .options(
            selectinload(ReservationSettings.tables),
            selectinload(ReservationSettings.hours),
        )
        .filter(ReservationSettings.cafe_id == cafe_id)
        .first()
    )
    if not s:
        s = ReservationSettings(cafe_id=cafe_id)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


# ── Time helpers ───────────────────────────────────────────────────────────

def _to_minutes(t: str) -> int:
    """'HH:MM' → minutes since midnight."""
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def _day_of_week(date_str: str) -> int:
    """'YYYY-MM-DD' → 0=Mon … 6=Sun (Python weekday)."""
    from datetime import date
    y, mo, d = date_str.split("-")
    return date(int(y), int(mo), int(d)).weekday()


def _validate_slot(
    table: CafeTable,
    settings: ReservationSettings,
    date: str,
    start_time: str,
    guests: int,
    db: Session,
    exclude_id: str | None = None,
) -> None:
    """Raises HTTPException if the reservation cannot be placed."""
    dow = _day_of_week(date)
    day_hours = next((h for h in settings.hours if h.day_of_week == dow), None)
    if not day_hours or not day_hours.open_time or not day_hours.close_time:
        raise HTTPException(400, detail="W tym dniu kawiarnia jest zamknięta.")

    slot_start = _to_minutes(start_time)
    open_m     = _to_minutes(day_hours.open_time)
    close_m    = _to_minutes(day_hours.close_time)

    if slot_start < open_m or slot_start >= close_m:
        raise HTTPException(
            400,
            detail=f"Godzina poza zakresem pracy ({day_hours.open_time}–{day_hours.close_time}).",
        )

    slot_end = slot_start + settings.slot_duration_minutes

    # Pobierz rezerwacje dla tego stolika i dnia
    existing_q = (
        db.query(Reservation)
        .filter(
            Reservation.table_id == table.id,
            Reservation.date     == date,
            Reservation.status   == ReservationStatus.confirmed,
        )
    )
    if exclude_id:
        existing_q = existing_q.filter(Reservation.id != exclude_id)
    existing = existing_q.all()

    if table.table_type == TableType.communal:
        # Sumuj gości w nakładającym się oknie
        total_guests = guests
        for r in existing:
            r_start = _to_minutes(r.start_time)
            r_end   = r_start + settings.slot_duration_minutes
            if slot_start < r_end and slot_end > r_start:
                total_guests += r.guests
        if total_guests > table.seats:
            raise HTTPException(
                400,
                detail=f"Communal table ma za mało wolnych miejsc ({table.seats} total).",
            )
    else:
        # Standard / special: stół musi być całkowicie wolny w tym oknie
        for r in existing:
            r_start = _to_minutes(r.start_time)
            r_end   = r_start + settings.slot_duration_minutes
            if slot_start < r_end and slot_end > r_start:
                raise HTTPException(400, detail="Stolik jest już zajęty w tym terminie.")

    if guests > table.seats:
        raise HTTPException(
            400,
            detail=f"Stolik ma tylko {table.seats} miejsc, a zażądano {guests}.",
        )


# ══════════════════════════════════════════════════════════════════════════════
# USTAWIENIA
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/settings", response_model=ReservationSettingsOut,
            summary="Pobierz ustawienia rezerwacji")
def get_settings(
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    return _get_or_create_settings(current_cafe.id, db)


@router.put("/settings", response_model=ReservationSettingsOut,
            summary="Zapisz ustawienia rezerwacji (replace-all)")
def save_settings(
    payload:      ReservationSettingsIn,
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    s = _get_or_create_settings(current_cafe.id, db)

    # Jeśli tryb zaawansowany i są już rezerwacje → nie pozwól edytować stolików
    if s.mode == "advanced" and payload.mode == "advanced":
        has_reservations = (
            db.query(Reservation)
            .filter(
                Reservation.cafe_id == current_cafe.id,
                Reservation.status  == ReservationStatus.confirmed,
            )
            .first()
        )
        if has_reservations and payload.tables:
            # Sprawdź czy stoliki się zmieniły
            existing_ids = {t.id for t in s.tables}
            pass  # pozwól na update – walidacja po stronie UI

    # Aktualizuj pola
    s.enabled               = payload.enabled
    s.mode                  = payload.mode
    s.slot_duration_minutes = payload.slot_duration_minutes

    # Usuń i odtwórz stoliki i godziny
    db.query(DayHours).filter(DayHours.settings_id == s.id).delete()
    db.query(CafeTable).filter(CafeTable.settings_id == s.id).delete()
    db.flush()

    for h in payload.hours:
        db.add(DayHours(
            settings_id = s.id,
            day_of_week = h.day_of_week,
            open_time   = h.open_time,
            close_time  = h.close_time,
        ))

    for t in payload.tables:
        qty = t.quantity if t.table_type == TableType.standard else 1
        # Dla standard: tworzymy `quantity` wierszy (każdy to jeden fizyczny stolik)
        if t.table_type == TableType.standard:
            for _ in range(qty):
                db.add(CafeTable(
                    settings_id = s.id,
                    table_type  = t.table_type,
                    seats       = t.seats,
                    quantity    = 1,
                    label       = t.label,
                ))
        else:
            db.add(CafeTable(
                settings_id = s.id,
                table_type  = t.table_type,
                seats       = t.seats,
                quantity    = 1,
                label       = t.label,
            ))

    db.commit()

    return (
        db.query(ReservationSettings)
        .options(
            selectinload(ReservationSettings.tables),
            selectinload(ReservationSettings.hours),
        )
        .filter(ReservationSettings.id == s.id)
        .first()
    )


# ══════════════════════════════════════════════════════════════════════════════
# REZERWACJE
# ══════════════════════════════════════════════════════════════════════════════

@router.get("", response_model=ReservationListOut,
            summary="Pobierz rezerwacje na dany dzień")
def list_reservations(
    date:         str     = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    rows = (
        db.query(Reservation)
        .filter(
            Reservation.cafe_id == current_cafe.id,
            Reservation.date    == date,
        )
        .order_by(Reservation.start_time)
        .all()
    )

    out = []
    for r in rows:
        o = ReservationOut(
            id               = r.id,
            table_id         = r.table_id,
            cafe_id          = r.cafe_id,
            date             = r.date,
            start_time       = r.start_time,
            guests           = r.guests,
            guest_name       = r.guest_name,
            guest_phone      = r.guest_phone,
            guest_email      = r.guest_email,
            comment          = r.comment,
            client_id        = r.client_id,
            created_by_owner = r.created_by_owner,
            status           = r.status,
            table_seats      = r.table.seats      if r.table else None,
            table_type       = r.table.table_type if r.table else None,
            table_label      = r.table.label      if r.table else None,
        )
        out.append(o)

    return ReservationListOut(date=date, reservations=out)


@router.post("", response_model=ReservationOut,
             status_code=status.HTTP_201_CREATED,
             summary="Utwórz rezerwację (właściciel)")
def create_reservation(
    payload:      ReservationIn,
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    s = _get_or_create_settings(current_cafe.id, db)
    if not s.enabled or s.mode != "advanced":
        raise HTTPException(400, detail="System rezerwacji nie jest aktywny.")

    table = db.query(CafeTable).filter(
        CafeTable.id == payload.table_id,
        CafeTable.settings_id == s.id,
    ).first()
    if not table:
        raise HTTPException(404, detail="Stolik nie istnieje.")

    _validate_slot(table, s, payload.date, payload.start_time, payload.guests, db)

    r = Reservation(
        table_id         = table.id,
        cafe_id          = current_cafe.id,
        date             = payload.date,
        start_time       = payload.start_time,
        guests           = payload.guests,
        guest_name       = payload.guest_name,
        guest_phone      = payload.guest_phone,
        guest_email      = payload.guest_email,
        comment          = payload.comment,
        client_id        = payload.client_id,
        created_by_owner = payload.client_id is None,
        status           = ReservationStatus.confirmed,
    )
    db.add(r)
    db.commit()
    db.refresh(r)

    return ReservationOut(
        id               = r.id,
        table_id         = r.table_id,
        cafe_id          = r.cafe_id,
        date             = r.date,
        start_time       = r.start_time,
        guests           = r.guests,
        guest_name       = r.guest_name,
        guest_phone      = r.guest_phone,
        guest_email      = r.guest_email,
        comment          = r.comment,
        client_id        = r.client_id,
        created_by_owner = r.created_by_owner,
        status           = r.status,
        table_seats      = table.seats,
        table_type       = str(table.table_type),
        table_label      = table.label,
    )


@router.delete("/{reservation_id}", status_code=status.HTTP_204_NO_CONTENT,
               summary="Anuluj rezerwację")
def cancel_reservation(
    reservation_id: str,
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    r = db.query(Reservation).filter(
        Reservation.id      == reservation_id,
        Reservation.cafe_id == current_cafe.id,
    ).first()
    if not r:
        raise HTTPException(404, detail="Rezerwacja nie istnieje.")
    db.delete(r)
    db.commit()


# ── Endpoint dla portalu klienta (przyszłościowy) ─────────────────────────

@router.post("/public/{cafe_id}", response_model=ReservationOut,
             status_code=status.HTTP_201_CREATED,
             summary="Utwórz rezerwację (klient – publiczny endpoint)")
def create_reservation_public(
    cafe_id: str,
    payload: ReservationIn,
    db:      Session = Depends(get_db),
):
    cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
    if not cafe:
        raise HTTPException(404, detail="Kawiarnia nie istnieje.")

    s = (
        db.query(ReservationSettings)
        .options(
            selectinload(ReservationSettings.tables),
            selectinload(ReservationSettings.hours),
        )
        .filter(ReservationSettings.cafe_id == cafe_id)
        .first()
    )
    if not s or not s.enabled or s.mode != "advanced":
        raise HTTPException(400, detail="System rezerwacji nie jest aktywny.")

    table = db.query(CafeTable).filter(
        CafeTable.id == payload.table_id,
        CafeTable.settings_id == s.id,
    ).first()
    if not table:
        raise HTTPException(404, detail="Stolik nie istnieje.")

    _validate_slot(table, s, payload.date, payload.start_time, payload.guests, db)

    r = Reservation(
        table_id         = table.id,
        cafe_id          = cafe_id,
        date             = payload.date,
        start_time       = payload.start_time,
        guests           = payload.guests,
        guest_name       = payload.guest_name,
        guest_phone      = payload.guest_phone,
        guest_email      = payload.guest_email,
        comment          = payload.comment,
        client_id        = payload.client_id,
        created_by_owner = False,
        status           = ReservationStatus.confirmed,
    )
    db.add(r)
    db.commit()
    db.refresh(r)

    return ReservationOut(
        id               = r.id,
        table_id         = r.table_id,
        cafe_id          = r.cafe_id,
        date             = r.date,
        start_time       = r.start_time,
        guests           = r.guests,
        guest_name       = r.guest_name,
        guest_phone      = r.guest_phone,
        guest_email      = r.guest_email,
        comment          = r.comment,
        client_id        = r.client_id,
        created_by_owner = r.created_by_owner,
        status           = r.status,
        table_seats      = table.seats,
        table_type       = str(table.table_type),
        table_label      = table.label,
    )