from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine
from app.core.cafe_time import cafe_today, cafe_tz_names, zone
from app.models.order import Order, OrderStatus
from app.models.reservation import Reservation, ReservationStatus
from app.core import analytics as analytics_svc

log = logging.getLogger(__name__)
_LOCK_ID = 742193610


def expire_stale_entries(db: Session) -> tuple[int, int]:
    # UTC+14 is the maximum, so candidates are dated no later than tomorrow UTC.
    horizon = (datetime.now(timezone.utc).date() + timedelta(days=1)).isoformat()
    orders = db.query(Order).filter(
        Order.status == OrderStatus.pending, Order.date <= horizon
    ).all()
    reservations = db.query(Reservation).filter(
        Reservation.status == ReservationStatus.pending, Reservation.date <= horizon
    ).all()

    tzs = cafe_tz_names({x.cafe_id for x in [*orders, *reservations]}, db)
    today = {cid: cafe_today(zone(name)).isoformat() for cid, name in tzs.items()}
    now = datetime.utcnow()

    n_orders = n_res = 0
    for order in orders:
        if order.date < today[order.cafe_id]:
            order.status, order.cancelled_by, order.updated_at = OrderStatus.cancelled, "system", now
            n_orders += 1
    for reservation in reservations:
        if reservation.date < today[reservation.cafe_id]:
            reservation.status = ReservationStatus.cancelled
            reservation.cancelled_by = "system"
            reservation.updated_at = now
            reservation.owner_note = "Rezerwacja wygasła — kawiarnia nie odpowiedziała przed terminem."
            n_res += 1

    if n_orders or n_res:
        db.commit()
    else:
        db.rollback()
    return n_orders, n_res


def run_expiration_job() -> tuple[int, int] | None:
    db = SessionLocal()
    try:
        if engine.dialect.name == "postgresql":
            if not db.execute(text("SELECT pg_try_advisory_xact_lock(:id)"), {"id": _LOCK_ID}).scalar():
                db.rollback()
                log.info("Expiration job skipped: advisory lock held by another process")
                return None
        counts = expire_stale_entries(db)
        analytics_svc.purge(db)
        log.info("Expiration job completed: orders=%s reservations=%s", *counts)
        return counts
    finally:
        db.close()
