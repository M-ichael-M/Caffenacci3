from __future__ import annotations

import logging
from datetime import date, datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine
from app.models.order import Order, OrderStatus
from app.models.reservation import Reservation, ReservationStatus
from app.core import analytics as analytics_svc

log = logging.getLogger(__name__)
_LOCK_ID = 742193610


def expire_stale_entries(db: Session) -> tuple[int, int]:
    today = date.today().isoformat()
    orders = (db.query(Order).filter(Order.status == OrderStatus.pending, Order.date < today)
        .update({Order.status: OrderStatus.cancelled, Order.cancelled_by: "system", Order.updated_at: datetime.utcnow()}, synchronize_session=False))
    reservations = (db.query(Reservation).filter(Reservation.status == ReservationStatus.pending, Reservation.date < today)
        .update({Reservation.status: ReservationStatus.cancelled, Reservation.cancelled_by: "system", Reservation.owner_note: "Rezerwacja wygasła — kawiarnia nie odpowiedziała przed terminem.", Reservation.updated_at: datetime.utcnow()}, synchronize_session=False))
    if orders or reservations: db.commit()
    else: db.rollback()
    return orders, reservations


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
