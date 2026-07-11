from __future__ import annotations

from datetime import date as date_cls, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.cafe import Cafe
from app.models.client import Client
from app.models.menu import MenuItem, MenuSection
from app.models.order import Order, OrderItem, OrderSettings, OrderStatus
from app.routers.client_auth import get_current_client
from app.schemas.order import (
    OrderSettingsIn, OrderSettingsOut,
    PublicOrderIn, PublicOrderCancelIn, ClientOrderIn,
    OrderStatusUpdate, OrderOut, OrderListOut,
    MAX_ORDER_DAYS_AHEAD,
    ClientOrderOut, ClientOrderListOut,   # ← nowe
)

router = APIRouter(prefix="/orders", tags=["orders"])
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


def _get_or_create_settings(cafe_id: str, db: Session) -> OrderSettings:
    s = db.query(OrderSettings).filter(OrderSettings.cafe_id == cafe_id).first()
    if not s:
        s = OrderSettings(cafe_id=cafe_id)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


def _validate_order_date(date_str: str) -> None:
    y, mo, d = date_str.split("-")
    target = date_cls(int(y), int(mo), int(d))
    today = date_cls.today()
    if target < today:
        raise HTTPException(400, detail="Nie można zamawiać na przeszłą datę.")
    if target > today + timedelta(days=MAX_ORDER_DAYS_AHEAD):
        raise HTTPException(
            400,
            detail=f"Zamówienia można składać maksymalnie {MAX_ORDER_DAYS_AHEAD} dni do przodu.",
        )


def _resolve_item(cafe_id: str, item_in, db: Session) -> tuple[str, float]:
    """Jeśli klient podał menu_item_id, nadpisz nazwę/cenę aktualnymi danymi
    z menu (ochrona przed manipulacją ceną). W przeciwnym razie (albo gdy
    pozycja nie istnieje / została usunięta) użyj tego, co przyszło z formularza
    — traktując to jako pozycję niestandardową."""
    if item_in.menu_item_id:
        mi = (
            db.query(MenuItem)
            .join(MenuSection, MenuItem.section_id == MenuSection.id)
            .filter(MenuItem.id == item_in.menu_item_id, MenuSection.cafe_id == cafe_id)
            .first()
        )
        if mi:
            return mi.name, mi.price
    return item_in.name, item_in.price


# ══════════════════════════════════════════════════════════════════════════════
# USTAWIENIA
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/settings", response_model=OrderSettingsOut,
            summary="Pobierz ustawienia zamówień")
def get_settings(
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    return _get_or_create_settings(current_cafe.id, db)


@router.put("/settings", response_model=OrderSettingsOut,
            summary="Włącz / wyłącz przyjmowanie zamówień")
def save_settings(
    payload:      OrderSettingsIn,
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    s = _get_or_create_settings(current_cafe.id, db)
    s.enabled = payload.enabled
    db.commit()
    db.refresh(s)
    return s


# ══════════════════════════════════════════════════════════════════════════════
# PUBLICZNY ENDPOINT — klient składa zamówienie (bez logowania)
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/public/{cafe_id}",
    response_model=OrderOut,
    status_code=status.HTTP_201_CREATED,
    summary="Złóż zamówienie jako klient (publiczny)",
)
def create_public_order(
    cafe_id: str,
    payload: PublicOrderIn,
    db:      Session = Depends(get_db),
):
    cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
    if not cafe:
        raise HTTPException(404, detail="Kawiarnia nie istnieje.")

    settings = db.query(OrderSettings).filter(OrderSettings.cafe_id == cafe_id).first()
    if not settings or not settings.enabled:
        raise HTTPException(400, detail="Ta kawiarnia nie przyjmuje zamówień online.")

    _validate_order_date(payload.date)

    order = Order(
        cafe_id     = cafe_id,
        client_nick = payload.client_nick,
        client_id   = payload.client_id,
        date        = payload.date,
        start_time  = payload.start_time,
        status      = OrderStatus.pending,
    )

    total = 0.0
    for item_in in payload.items:
        name, price = _resolve_item(cafe_id, item_in, db)
        total += price * item_in.quantity
        order.items.append(OrderItem(
            menu_item_id = item_in.menu_item_id,
            name         = name,
            price        = price,
            quantity     = item_in.quantity,
        ))
    order.total_value = round(total, 2)

    db.add(order)
    db.commit()
    db.refresh(order)
    return order


# ══════════════════════════════════════════════════════════════════════════════
# ZAMÓWIENIE OD ZALOGOWANEGO KLIENTA — wygenerowana strona kawiarni
# ══════════════════════════════════════════════════════════════════════════════
# client_nick / client_id NIE są przyjmowane z ciała żądania — pochodzą
# z tokenu JWT klienta, dzięki czemu nie da się złożyć zamówienia "pod kogoś".

@router.post(
    "/client/{cafe_id}",
    response_model=OrderOut,
    status_code=status.HTTP_201_CREATED,
    summary="Złóż zamówienie jako zalogowany klient",
)
def create_order_as_client(
    cafe_id: str,
    payload: ClientOrderIn,
    current_client: Client  = Depends(get_current_client),
    db:             Session = Depends(get_db),
):
    cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
    if not cafe:
        raise HTTPException(404, detail="Kawiarnia nie istnieje.")

    settings = db.query(OrderSettings).filter(OrderSettings.cafe_id == cafe_id).first()
    if not settings or not settings.enabled:
        raise HTTPException(400, detail="Ta kawiarnia nie przyjmuje zamówień online.")

    _validate_order_date(payload.date)

    order = Order(
        cafe_id     = cafe_id,
        client_nick = current_client.nick,
        client_id   = current_client.id,
        date        = payload.date,
        start_time  = payload.start_time,
        status      = OrderStatus.pending,
    )

    total = 0.0
    for item_in in payload.items:
        name, price = _resolve_item(cafe_id, item_in, db)
        total += price * item_in.quantity
        order.items.append(OrderItem(
            menu_item_id = item_in.menu_item_id,
            name         = name,
            price        = price,
            quantity     = item_in.quantity,
        ))
    order.total_value = round(total, 2)

    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.post(
    "/public/{order_id}/cancel",
    response_model=OrderOut,
    summary="Anuluj zamówienie jako klient (publiczny)",
)
def cancel_order_public(
    order_id: str,
    payload:  PublicOrderCancelIn,
    db:       Session = Depends(get_db),
):
    order = db.query(Order).options(selectinload(Order.items)).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, detail="Zamówienie nie istnieje.")
    if order.status != OrderStatus.pending:
        raise HTTPException(
            400,
            detail=f"Zamówienie ma już status '{order.status}' i nie może być anulowane.",
        )
    if order.client_id and order.client_id != payload.client_id:
        raise HTTPException(403, detail="Brak uprawnień do anulowania tego zamówienia.")

    order.status       = OrderStatus.cancelled
    order.cancelled_by = "client"
    order.updated_at   = datetime.utcnow()
    db.commit()
    db.refresh(order)
    return order

# ══════════════════════════════════════════════════════════════════════════════
# MOJE ZAMÓWIENIA — połączony widok klienta, wszystkie kawiarnie naraz
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/client/mine",
    response_model=ClientOrderListOut,
    summary="Pobierz wszystkie zamówienia zalogowanego klienta (wszystkie kawiarnie)",
)
def list_my_orders(
    current_client: Client = Depends(get_current_client),
    db:             Session = Depends(get_db),
):
    rows = (
        db.query(Order)
        .options(selectinload(Order.items))
        .filter(Order.client_id == current_client.id)
        .order_by(Order.created_at.desc())
        .all()
    )

    cafe_ids = {o.cafe_id for o in rows}
    cafes = {c.id: c for c in db.query(Cafe).filter(Cafe.id.in_(cafe_ids)).all()} if cafe_ids else {}

    result = [
        ClientOrderOut(
            **OrderOut.model_validate(o).model_dump(),
            cafe_name=(cafes.get(o.cafe_id).cafe_name if cafes.get(o.cafe_id) else "Nieznana kawiarnia"),
        )
        for o in rows
    ]
    return ClientOrderListOut(orders=result)

# ══════════════════════════════════════════════════════════════════════════════
# LISTA ZAMÓWIEŃ (właściciel) — chronologicznie wg daty i godziny
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "",
    response_model=OrderListOut,
    summary="Pobierz zamówienia (właściciel)",
)
def list_orders(
    status_filter: str | None = Query(None, alias="status"),
    current_cafe:  Cafe    = Depends(get_current_cafe),
    db:            Session = Depends(get_db),
):
    q = (
        db.query(Order)
        .options(selectinload(Order.items))
        .filter(Order.cafe_id == current_cafe.id)
    )
    if status_filter:
        try:
            st = OrderStatus(status_filter)
            q = q.filter(Order.status == st)
        except ValueError:
            raise HTTPException(400, detail=f"Nieprawidłowy status: {status_filter}")

    rows = q.order_by(Order.date, Order.start_time).all()
    return OrderListOut(orders=rows)


# ══════════════════════════════════════════════════════════════════════════════
# ZMIANA STATUSU — realizacja lub anulowanie (właściciel)
# ══════════════════════════════════════════════════════════════════════════════

@router.patch(
    "/{order_id}/status",
    response_model=OrderOut,
    summary="Oznacz zamówienie jako zrealizowane lub anuluj",
)
def update_order_status(
    order_id:     str,
    payload:      OrderStatusUpdate,
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    order = (
        db.query(Order)
        .options(selectinload(Order.items))
        .filter(Order.id == order_id, Order.cafe_id == current_cafe.id)
        .first()
    )
    if not order:
        raise HTTPException(404, detail="Zamówienie nie istnieje.")

    if order.status != OrderStatus.pending:
        raise HTTPException(
            400,
            detail=f"Zamówienie ma już status '{order.status}' i nie może być zmienione.",
        )

    from app.schemas.order import OrderStatusEnum
    if payload.status not in (OrderStatusEnum.completed, OrderStatusEnum.cancelled):
        raise HTTPException(400, detail="Dozwolone statusy: completed, cancelled.")

    order.status       = payload.status
    order.cancelled_by = "owner" if payload.status == OrderStatusEnum.cancelled else None
    order.updated_at   = datetime.utcnow()
    db.commit()
    db.refresh(order)
    return order
