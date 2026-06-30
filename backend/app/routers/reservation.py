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
    PublicReservationIn, ReservationStatusUpdate,
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


def _reservation_to_out(r: Reservation) -> ReservationOut:
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
        owner_note       = r.owner_note,
        created_at       = r.created_at,
        table_seats      = r.table.seats      if r.table else None,
        table_type       = str(r.table.table_type) if r.table else None,
        table_label      = r.table.label      if r.table else None,
    )


# ── Time helpers ───────────────────────────────────────────────────────────

def _to_minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def _day_of_week(date_str: str) -> int:
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
        total_guests = guests
        for r in existing:
            r_start = _to_minutes(r.start_time)
            r_end   = r_start + settings.slot_duration_minutes
            if slot_start < r_end and slot_end > r_start:
                total_guests += r.guests
        if total_guests > table.seats:
            raise HTTPException(400, detail=f"Za mało wolnych miejsc przy stole ({table.seats} total).")
    else:
        for r in existing:
            r_start = _to_minutes(r.start_time)
            r_end   = r_start + settings.slot_duration_minutes
            if slot_start < r_end and slot_end > r_start:
                raise HTTPException(400, detail="Stolik jest już zajęty w tym terminie.")

    if guests > table.seats:
        raise HTTPException(400, detail=f"Stolik ma tylko {table.seats} miejsc.")


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
            summary="Zapisz ustawienia rezerwacji")
def save_settings(
    payload:      ReservationSettingsIn,
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    s = _get_or_create_settings(current_cafe.id, db)

    s.enabled               = payload.enabled
    s.mode                  = payload.mode
    s.slot_duration_minutes = payload.slot_duration_minutes

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
# PUBLICZNY ENDPOINT — klient składa rezerwację (tryb simple)
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/public/{cafe_id}",
    response_model=ReservationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Złóż rezerwację jako klient (publiczny, simple mode)",
)
def create_public_reservation(
    cafe_id: str,
    payload: PublicReservationIn,
    db:      Session = Depends(get_db),
):
    cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
    if not cafe:
        raise HTTPException(404, detail="Kawiarnia nie istnieje.")

    s = (
        db.query(ReservationSettings)
        .filter(ReservationSettings.cafe_id == cafe_id)
        .first()
    )
    if not s or not s.enabled:
        raise HTTPException(400, detail="Ta kawiarnia nie przyjmuje rezerwacji online.")

    # Walidacja daty — nie można rezerwować w przeszłości
    from datetime import date as date_cls
    y, mo, d = payload.date.split("-")
    if date_cls(int(y), int(mo), int(d)) < date_cls.today():
        raise HTTPException(400, detail="Nie można rezerwować w przeszłości.")

    r = Reservation(
        table_id         = None,        # brak przydziału stolika w trybie simple
        cafe_id          = cafe_id,
        date             = payload.date,
        start_time       = payload.start_time,
        guests           = payload.guests,
        guest_name       = payload.guest_name,
        guest_phone      = payload.guest_phone,
        guest_email      = payload.guest_email,
        comment          = payload.comment,
        client_id        = None,
        created_by_owner = False,
        status           = ReservationStatus.pending,
    )
    db.add(r)
    db.commit()
    db.refresh(r)

    return _reservation_to_out(r)


# ══════════════════════════════════════════════════════════════════════════════
# LISTA REZERWACJI (właściciel)
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "",
    response_model=ReservationListOut,
    summary="Pobierz rezerwacje (właściciel)",
)
def list_reservations(
    date:         str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    status_filter: str | None = Query(None, alias="status"),
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    q = (
        db.query(Reservation)
        .filter(Reservation.cafe_id == current_cafe.id)
    )
    if date:
        q = q.filter(Reservation.date == date)
    if status_filter:
        try:
            st = ReservationStatus(status_filter)
            q = q.filter(Reservation.status == st)
        except ValueError:
            raise HTTPException(400, detail=f"Nieprawidłowy status: {status_filter}")

    rows = q.order_by(Reservation.date, Reservation.start_time).all()
    return ReservationListOut(date=date, reservations=[_reservation_to_out(r) for r in rows])


# ══════════════════════════════════════════════════════════════════════════════
# ZMIANA STATUSU — akceptacja lub odrzucenie
# ══════════════════════════════════════════════════════════════════════════════

@router.patch(
    "/{reservation_id}/status",
    response_model=ReservationOut,
    summary="Akceptuj lub odrzuć rezerwację",
)
def update_reservation_status(
    reservation_id: str,
    payload:        ReservationStatusUpdate,
    current_cafe:   Cafe    = Depends(get_current_cafe),
    db:             Session = Depends(get_db),
):
    r = (
        db.query(Reservation)
        .filter(
            Reservation.id      == reservation_id,
            Reservation.cafe_id == current_cafe.id,
        )
        .first()
    )
    if not r:
        raise HTTPException(404, detail="Rezerwacja nie istnieje.")

    if r.status != ReservationStatus.pending:
        raise HTTPException(
            400,
            detail=f"Rezerwacja ma już status '{r.status}' i nie może być zmieniona.",
        )

    if payload.status not in (ReservationStatus.confirmed, ReservationStatus.cancelled):
        raise HTTPException(400, detail="Dozwolone statusy: confirmed, cancelled.")

    r.status     = payload.status
    r.owner_note = payload.owner_note
    from datetime import datetime
    r.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(r)

    return _reservation_to_out(r)


# ══════════════════════════════════════════════════════════════════════════════
# TWORZENIE przez właściciela (zaawansowane)
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "",
    response_model=ReservationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Utwórz rezerwację (właściciel, advanced mode)",
)
def create_reservation(
    payload:      ReservationIn,
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    s = _get_or_create_settings(current_cafe.id, db)
    if not s.enabled or s.mode != "advanced":
        raise HTTPException(400, detail="System rezerwacji nie jest aktywny w trybie zaawansowanym.")

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
        status           = ReservationStatus.confirmed,  # właściciel = od razu confirmed
    )
    db.add(r)
    db.commit()
    db.refresh(r)

    return _reservation_to_out(r)


# ══════════════════════════════════════════════════════════════════════════════
# USUNIĘCIE
# ══════════════════════════════════════════════════════════════════════════════

@router.delete(
    "/{reservation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Usuń rezerwację",
)
def delete_reservation(
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