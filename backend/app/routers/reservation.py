from __future__ import annotations

from datetime import date as date_cls, datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.cafe import Cafe
from app.models.cafe_profile import CafeProfile
from app.models.client import Client
from app.models.reservation import (
    ReservationSettings, DayHours, CafeTable, Reservation,
    TableType, ReservationStatus,
)
from app.routers.client_auth import get_current_client
from app.schemas.reservation import (
    ReservationSettingsIn, ReservationSettingsOut,
    ReservationIn, ReservationOut, ReservationListOut,
    PublicReservationIn, ClientReservationIn, ClientAdvancedReservationIn,
    ReservationStatusUpdate, ReservationInfoOut, OccupiedSlotOut,
    ReservationHourExceptionOut,
    ClientReservationOut, ClientReservationListOut,   # ← nowe
)

router = APIRouter(prefix="/reservations", tags=["reservations"])
bearer_scheme = HTTPBearer()


# ── Auth helper (właściciel) ─────────────────────────────────────────────────

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


def _get_profile_hour_exceptions(cafe_id: str, db: Session) -> list[ReservationHourExceptionOut]:
    """Wyjątki godzinowe z profilu kawiarni (te same, co na wizytówce
    publicznej) — używane, żeby widget rezerwacji zaawansowanej nigdy nie
    proponował terminu w dniu, w którym kawiarnia zadeklarowała się jako
    wyjątkowo zamknięta / pracująca w innych godzinach."""
    profile = (
        db.query(CafeProfile)
        .options(selectinload(CafeProfile.hour_exceptions))
        .filter(CafeProfile.cafe_id == cafe_id)
        .first()
    )
    if not profile:
        return []
    return [
        ReservationHourExceptionOut(
            date=e.date, is_closed=e.is_closed,
            open_time=e.open_time, close_time=e.close_time,
        )
        for e in profile.hour_exceptions
    ]


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


def _from_minutes(m: int) -> str:
    hh = str((m // 60) % 24).zfill(2)
    mm = str(m % 60).zfill(2)
    return f"{hh}:{mm}"


def _day_of_week(date_str: str) -> int:
    y, mo, d = date_str.split("-")
    return date_cls(int(y), int(mo), int(d)).weekday()


def _validate_not_in_past(date_str: str, start_time: str) -> None:
    """Blokuje rezerwację w przeszłości oraz na dzisiejszą datę, jeśli podana
    godzina rozpoczęcia już nadeszła lub minęła — rezerwacja musi dotyczyć
    momentu w przyszłości."""
    y, mo, d = date_str.split("-")
    target_date = date_cls(int(y), int(mo), int(d))
    now = datetime.now()

    if target_date < now.date():
        raise HTTPException(400, detail="Nie można rezerwować w przeszłości.")

    if target_date == now.date():
        start_minutes = _to_minutes(start_time)
        now_minutes = now.hour * 60 + now.minute
        if start_minutes <= now_minutes:
            raise HTTPException(
                400,
                detail="Nie można rezerwować na bieżącą ani wcześniejszą godzinę — wybierz późniejszy termin.",
            )


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
# INFORMACJE PUBLICZNE — tryb, stoliki, godziny, zajętość (bez logowania)
# ══════════════════════════════════════════════════════════════════════════════
# Używane przez widget rezerwacji na stronie klienta, żeby wiedzieć:
#   • w jakim trybie działa kawiarnia (simple / advanced),
#   • jakie stoliki są dostępne w trybie advanced,
#   • które terminy są już zajęte dla wybranej daty (do wyszarzenia w UI).

@router.get(
    "/info/{cafe_id}",
    response_model=ReservationInfoOut,
    summary="Publiczne informacje o rezerwacjach: tryb, stoliki, godziny, zajętość",
)
def get_reservation_info(
    cafe_id: str,
    date:    str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    db:      Session = Depends(get_db),
):
    cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
    if not cafe:
        raise HTTPException(404, detail="Kawiarnia nie istnieje.")

    hour_exceptions = _get_profile_hour_exceptions(cafe_id, db)

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
        return ReservationInfoOut(
            cafe_id=cafe_id, enabled=False, mode="simple",
            slot_duration_minutes=60, tables=[], hours=[], occupied=[],
            hour_exceptions=hour_exceptions,
        )

    occupied: list[OccupiedSlotOut] = []
    if date and s.enabled and s.mode == "advanced":
        rows = (
            db.query(Reservation)
            .filter(
                Reservation.cafe_id == cafe_id,
                Reservation.date    == date,
                Reservation.status  == ReservationStatus.confirmed,
                Reservation.table_id.isnot(None),
            )
            .all()
        )
        for r in rows:
            start_m = _to_minutes(r.start_time)
            end_m   = start_m + s.slot_duration_minutes
            occupied.append(OccupiedSlotOut(
                table_id=r.table_id,
                start_time=r.start_time,
                end_time=_from_minutes(end_m),
                guests=r.guests,
            ))

    return ReservationInfoOut(
        cafe_id=cafe_id,
        enabled=s.enabled,
        mode=s.mode,
        slot_duration_minutes=s.slot_duration_minutes,
        tables=s.tables,
        hours=s.hours,
        occupied=occupied,
        hour_exceptions=hour_exceptions,
    )


# ══════════════════════════════════════════════════════════════════════════════
# PUBLICZNY ENDPOINT — klient składa rezerwację (bez logowania) — TRYB SIMPLE
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/public/{cafe_id}",
    response_model=ReservationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Złóż rezerwację jako klient (publiczny, WYŁĄCZNIE simple mode)",
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

    if s.mode != "simple":
        raise HTTPException(
            400,
            detail="Ta kawiarnia korzysta z zaawansowanego systemu rezerwacji — wymagany jest wybór stolika przez zalogowanego klienta.",
        )

    _validate_not_in_past(payload.date, payload.start_time)

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
# REZERWACJA OD ZALOGOWANEGO KLIENTA — TRYB SIMPLE (pending → akceptacja właściciela)
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/client/{cafe_id}",
    response_model=ReservationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Złóż rezerwację jako zalogowany klient (tryb simple — czeka na akceptację)",
)
def create_reservation_as_client(
    cafe_id: str,
    payload: ClientReservationIn,
    current_client: Client  = Depends(get_current_client),
    db:             Session = Depends(get_db),
):
    cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
    if not cafe:
        raise HTTPException(404, detail="Kawiarnia nie istnieje.")

    s = db.query(ReservationSettings).filter(ReservationSettings.cafe_id == cafe_id).first()
    if not s or not s.enabled:
        raise HTTPException(400, detail="Ta kawiarnia nie przyjmuje rezerwacji online.")

    if s.mode != "simple":
        raise HTTPException(
            400,
            detail="Ta kawiarnia korzysta z zaawansowanego systemu rezerwacji. Użyj POST /reservations/client/{cafe_id}/advanced.",
        )

    _validate_not_in_past(payload.date, payload.start_time)

    r = Reservation(
        table_id         = None,
        cafe_id          = cafe_id,
        date             = payload.date,
        start_time       = payload.start_time,
        guests           = payload.guests,
        guest_name       = current_client.full_name,
        guest_phone      = payload.guest_phone or current_client.phone,
        guest_email      = payload.guest_email or current_client.email,
        comment          = payload.comment,
        client_id        = current_client.id,
        created_by_owner = False,
        status           = ReservationStatus.pending,
    )
    db.add(r)
    db.commit()
    db.refresh(r)

    return _reservation_to_out(r)


# ══════════════════════════════════════════════════════════════════════════════
# REZERWACJA OD ZALOGOWANEGO KLIENTA — TRYB ADVANCED (od razu confirmed)
# ══════════════════════════════════════════════════════════════════════════════
# Dokładnie ten sam mechanizm co przy rezerwacji zakładanej przez właściciela:
# klient wybiera stolik + termin, backend waliduje dostępność (_validate_slot)
# i od razu potwierdza. Brak statusu pending, brak akceptacji, brak jakiejkolwiek
# zależności od trybu simple.

@router.post(
    "/client/{cafe_id}/advanced",
    response_model=ReservationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Złóż rezerwację jako zalogowany klient (tryb advanced — od razu potwierdzona)",
)
def create_advanced_reservation_as_client(
    cafe_id: str,
    payload: ClientAdvancedReservationIn,
    current_client: Client  = Depends(get_current_client),
    db:             Session = Depends(get_db),
):
    cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
    if not cafe:
        raise HTTPException(404, detail="Kawiarnia nie istnieje.")

    s = (
        db.query(ReservationSettings)
        .options(selectinload(ReservationSettings.hours))
        .filter(ReservationSettings.cafe_id == cafe_id)
        .first()
    )
    if not s or not s.enabled or s.mode != "advanced":
        raise HTTPException(400, detail="Ta kawiarnia nie obsługuje rezerwacji w trybie zaawansowanym.")

    table = db.query(CafeTable).filter(
        CafeTable.id == payload.table_id,
        CafeTable.settings_id == s.id,
    ).first()
    if not table:
        raise HTTPException(404, detail="Wybrany stolik nie istnieje.")

    _validate_not_in_past(payload.date, payload.start_time)

    _validate_slot(table, s, payload.date, payload.start_time, payload.guests, db)

    r = Reservation(
        table_id         = table.id,
        cafe_id          = cafe_id,
        date             = payload.date,
        start_time       = payload.start_time,
        guests           = payload.guests,
        guest_name       = current_client.full_name,
        guest_phone      = payload.guest_phone or current_client.phone,
        guest_email      = payload.guest_email or current_client.email,
        comment          = payload.comment,
        client_id        = current_client.id,
        created_by_owner = False,
        status           = ReservationStatus.confirmed,  # advanced = od razu potwierdzone
    )
    db.add(r)
    db.commit()
    db.refresh(r)

    return _reservation_to_out(r)

# ══════════════════════════════════════════════════════════════════════════════
# MOJE REZERWACJE — połączony widok klienta, wszystkie kawiarnie naraz
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/client/mine",
    response_model=ClientReservationListOut,
    summary="Pobierz wszystkie rezerwacje zalogowanego klienta (wszystkie kawiarnie)",
)
def list_my_reservations(
    current_client: Client = Depends(get_current_client),
    db:             Session = Depends(get_db),
):
    rows = (
        db.query(Reservation)
        .options(selectinload(Reservation.table))
        .filter(Reservation.client_id == current_client.id)
        .order_by(Reservation.date.desc(), Reservation.start_time.desc())
        .all()
    )

    cafe_ids = {r.cafe_id for r in rows}
    cafes = {c.id: c for c in db.query(Cafe).filter(Cafe.id.in_(cafe_ids)).all()} if cafe_ids else {}

    result: list[ClientReservationOut] = []
    for r in rows:
        base = _reservation_to_out(r)
        cafe = cafes.get(r.cafe_id)
        result.append(ClientReservationOut(
            **base.model_dump(),
            cafe_name=cafe.cafe_name if cafe else "Nieznana kawiarnia",
            is_advanced=r.table_id is not None,
        ))

    return ClientReservationListOut(reservations=result)

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
# ZMIANA STATUSU — akceptacja lub odrzucenie — WYŁĄCZNIE TRYB SIMPLE
# ══════════════════════════════════════════════════════════════════════════════

@router.patch(
    "/{reservation_id}/status",
    response_model=ReservationOut,
    summary="Akceptuj lub odrzuć rezerwację (tryb simple)",
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
    r.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(r)

    return _reservation_to_out(r)


# ══════════════════════════════════════════════════════════════════════════════
# TWORZENIE przez właściciela (zaawansowane) — bez zmian
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