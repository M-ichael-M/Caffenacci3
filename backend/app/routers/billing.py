from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.cafe import Cafe
from app.models.billing import Subscription
from app.schemas.billing import SubscriptionStatusOut, PromoRedeemIn

router = APIRouter(prefix="/billing", tags=["billing"])
bearer_scheme = HTTPBearer()

SUBSCRIPTION_PERIOD_DAYS = 30
CANCEL_CUTOFF = timedelta(days=1)  # trzeba anulować najpóźniej dzień przed odnowieniem

# Kody promocyjne na potrzeby demo — zanim podłączymy prawdziwe płatności.
PROMO_CODES: dict[str, int] = {
    "CAFFENACCI7":  7,
    "CAFFENACCI30": 30,
    "DEMO14":       14,
}


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


def _sync_subscription(sub: Subscription, db: Session) -> None:
    """Wylicza w locie, czy opłacony okres (albo kilka kolejnych okresów,
    jeśli aplikacja długo nie była otwierana) już minął i — dla płatnej
    subskrypcji bez zaplanowanego anulowania — symuluje automatyczne
    odnowienie co 30 dni. Zapisuje zmiany w bazie."""
    now = datetime.utcnow()
    if now < sub.period_end:
        return

    if sub.kind == "promo":
        # Kod promocyjny nigdy się nie odnawia — po prostu wygasa.
        return

    if sub.cancel_at_period_end:
        # Zaplanowane anulowanie — subskrypcja kończy się na dobre.
        return

    changed = False
    while now >= sub.period_end:
        sub.period_start = sub.period_end
        sub.period_end = sub.period_start + timedelta(days=SUBSCRIPTION_PERIOD_DAYS)
        changed = True
    if changed:
        sub.updated_at = now
        db.commit()
        db.refresh(sub)


def _get_effective_subscription(cafe_id: str, db: Session) -> Subscription | None:
    sub = db.query(Subscription).filter(Subscription.cafe_id == cafe_id).first()
    if sub:
        _sync_subscription(sub, db)
    return sub


def _to_status_out(sub: Subscription | None) -> SubscriptionStatusOut:
    if not sub:
        return SubscriptionStatusOut(status="none")

    now = datetime.utcnow()

    if now >= sub.period_end:
        return SubscriptionStatusOut(
            kind=sub.kind,
            status="expired",
            period_start=sub.period_start,
            period_end=sub.period_end,
            cancel_at_period_end=sub.cancel_at_period_end,
            promo_code=sub.promo_code,
            can_cancel=False,
        )

    is_cancelling = sub.kind == "subscription" and sub.cancel_at_period_end
    can_cancel = (
        sub.kind == "subscription"
        and not sub.cancel_at_period_end
        and now <= sub.period_end - CANCEL_CUTOFF
    )

    return SubscriptionStatusOut(
        kind=sub.kind,
        status="cancelling" if is_cancelling else "active",
        period_start=sub.period_start,
        period_end=sub.period_end,
        cancel_at_period_end=sub.cancel_at_period_end,
        promo_code=sub.promo_code,
        can_cancel=can_cancel,
        next_billing_date=(sub.period_end if sub.kind == "subscription" and not sub.cancel_at_period_end else None),
    )


def has_active_access(cafe_id: str, db: Session) -> bool:
    """Czy kawiarnia ma prawo mieć opublikowaną stronę — aktywna płatna
    subskrypcja (również z zaplanowanym anulowaniem, bo opłacony okres
    jeszcze trwa) albo ważny kod promocyjny."""
    sub = _get_effective_subscription(cafe_id, db)
    if not sub:
        return False
    return datetime.utcnow() < sub.period_end


# ══════════════════════════════════════════════════════════════════════════════
# STATUS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/status", response_model=SubscriptionStatusOut, summary="Pobierz status subskrypcji")
def get_status(
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    sub = _get_effective_subscription(current_cafe.id, db)
    return _to_status_out(sub)


# ══════════════════════════════════════════════════════════════════════════════
# AKTYWACJA (symulacja — bez prawdziwej płatności)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/subscribe", response_model=SubscriptionStatusOut,
             summary="Aktywuj subskrypcję (symulacja płatności)")
def subscribe(
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    existing = _get_effective_subscription(current_cafe.id, db)
    now = datetime.utcnow()
    if existing and now < existing.period_end:
        raise HTTPException(400, detail="Masz już aktywny dostęp — nie można aktywować kolejnej subskrypcji.")

    if existing:
        existing.kind = "subscription"
        existing.promo_code = None
        existing.period_start = now
        existing.period_end = now + timedelta(days=SUBSCRIPTION_PERIOD_DAYS)
        existing.cancel_at_period_end = False
        existing.cancelled_at = None
        existing.updated_at = now
        db.commit()
        db.refresh(existing)
        sub = existing
    else:
        sub = Subscription(
            cafe_id=current_cafe.id,
            kind="subscription",
            period_start=now,
            period_end=now + timedelta(days=SUBSCRIPTION_PERIOD_DAYS),
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)

    return _to_status_out(sub)


@router.post("/promo", response_model=SubscriptionStatusOut,
             summary="Aktywuj kod promocyjny")
def redeem_promo(
    payload:      PromoRedeemIn,
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    code = payload.code.strip().upper()
    days = PROMO_CODES.get(code)
    if not days:
        raise HTTPException(400, detail="Nieprawidłowy lub nieaktywny kod promocyjny.")

    existing = _get_effective_subscription(current_cafe.id, db)
    now = datetime.utcnow()
    if existing and now < existing.period_end:
        raise HTTPException(400, detail="Masz już aktywny dostęp — nie można aktywować kodu promocyjnego.")

    if existing:
        existing.kind = "promo"
        existing.promo_code = code
        existing.period_start = now
        existing.period_end = now + timedelta(days=days)
        existing.cancel_at_period_end = False
        existing.cancelled_at = None
        existing.updated_at = now
        db.commit()
        db.refresh(existing)
        sub = existing
    else:
        sub = Subscription(
            cafe_id=current_cafe.id,
            kind="promo",
            promo_code=code,
            period_start=now,
            period_end=now + timedelta(days=days),
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)

    return _to_status_out(sub)


# ══════════════════════════════════════════════════════════════════════════════
# ANULOWANIE / WZNOWIENIE (wyłącznie płatna subskrypcja)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/cancel", response_model=SubscriptionStatusOut,
             summary="Anuluj subskrypcję (obowiązuje do końca opłaconego okresu)")
def cancel_subscription(
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    sub = _get_effective_subscription(current_cafe.id, db)
    now = datetime.utcnow()
    if not sub or sub.kind != "subscription" or now >= sub.period_end:
        raise HTTPException(400, detail="Brak aktywnej subskrypcji do anulowania.")
    if sub.cancel_at_period_end:
        raise HTTPException(400, detail="Subskrypcja jest już zaplanowana do anulowania.")
    if now > sub.period_end - CANCEL_CUTOFF:
        raise HTTPException(
            400,
            detail="Za późno na anulowanie przed najbliższym odnowieniem — spróbuj ponownie po tej dacie.",
        )

    sub.cancel_at_period_end = True
    sub.cancelled_at = now
    sub.updated_at = now
    db.commit()
    db.refresh(sub)
    return _to_status_out(sub)


@router.post("/resume", response_model=SubscriptionStatusOut,
             summary="Cofnij zaplanowane anulowanie subskrypcji")
def resume_subscription(
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    sub = _get_effective_subscription(current_cafe.id, db)
    now = datetime.utcnow()
    if not sub or sub.kind != "subscription" or now >= sub.period_end or not sub.cancel_at_period_end:
        raise HTTPException(400, detail="Brak zaplanowanego anulowania do cofnięcia.")

    sub.cancel_at_period_end = False
    sub.cancelled_at = None
    sub.updated_at = now
    db.commit()
    db.refresh(sub)
    return _to_status_out(sub)