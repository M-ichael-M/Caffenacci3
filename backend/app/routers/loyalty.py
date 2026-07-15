from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.cafe import Cafe
from app.models.cafe_profile import CafeProfile
from app.models.client import Client
from app.models.loyalty import (
    LoyaltySettings, LoyaltyReward, ClientLoyalty, LoyaltyTransaction,
)
from app.routers.client_auth import get_current_client
from app.schemas.loyalty import (
    LoyaltySettingsIn, LoyaltySettingsOut,
    LoyaltyLookupOut, LoyaltyEarnIn, LoyaltyRedeemIn, LoyaltyStampActionIn,
    LoyaltyBalanceOut, ClientLoyaltyCodeOut,
    ClientCafeLoyaltyOut, ClientCafeLoyaltyListOut,
)

router = APIRouter(prefix="/loyalty", tags=["loyalty"])
bearer_scheme = HTTPBearer()


# ── Auth helper (właściciel) ─────────────────────────────────────────────

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


def _get_or_create_settings(cafe_id: str, db: Session) -> LoyaltySettings:
    s = (
        db.query(LoyaltySettings)
        .options(selectinload(LoyaltySettings.rewards))
        .filter(LoyaltySettings.cafe_id == cafe_id)
        .first()
    )
    if not s:
        s = LoyaltySettings(cafe_id=cafe_id)
        db.add(s)
        db.commit()
        db.refresh(s)
        s = (
            db.query(LoyaltySettings)
            .options(selectinload(LoyaltySettings.rewards))
            .filter(LoyaltySettings.id == s.id)
            .first()
        )
    return s


def _get_or_create_client_loyalty(cafe_id: str, client_id: str, db: Session) -> ClientLoyalty:
    cl = (
        db.query(ClientLoyalty)
        .filter(ClientLoyalty.cafe_id == cafe_id, ClientLoyalty.client_id == client_id)
        .first()
    )
    if not cl:
        cl = ClientLoyalty(cafe_id=cafe_id, client_id=client_id)
        db.add(cl)
        db.commit()
        db.refresh(cl)
    return cl


def _find_client_by_code(code: str, db: Session) -> Client:
    client = db.query(Client).filter(Client.loyalty_code == code.strip().upper()).first()
    if not client:
        raise HTTPException(404, detail="Nie znaleziono użytkownika o podanym kodzie lojalnościowym.")
    return client


# ══════════════════════════════════════════════════════════════════════════════
# USTAWIENIA (właściciel)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/settings", response_model=LoyaltySettingsOut,
            summary="Pobierz ustawienia programu lojalnościowego")
def get_settings(
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    return _get_or_create_settings(current_cafe.id, db)


@router.put("/settings", response_model=LoyaltySettingsOut,
            summary="Zapisz ustawienia programu lojalnościowego")
def save_settings(
    payload:      LoyaltySettingsIn,
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    s = _get_or_create_settings(current_cafe.id, db)

    s.enabled            = payload.enabled
    s.mode               = payload.mode
    s.stamps_max         = payload.stamps_max
    s.stamps_earn_desc   = payload.stamps_earn_desc
    s.stamps_reward_desc = payload.stamps_reward_desc
    s.updated_at         = datetime.utcnow()

    # Nagrody — replace-all (analogicznie do menu)
    db.query(LoyaltyReward).filter(LoyaltyReward.settings_id == s.id).delete()
    for r in payload.rewards:
        db.add(LoyaltyReward(
            settings_id=s.id,
            name=r.name,
            cost_points=r.cost_points,
            position=r.position,
        ))

    db.commit()
    return _get_or_create_settings(current_cafe.id, db)


# ══════════════════════════════════════════════════════════════════════════════
# KASA — wyszukanie klienta po kodzie lojalnościowym (właściciel / pracownik)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/lookup/{loyalty_code}", response_model=LoyaltyLookupOut,
            summary="Wyszukaj klienta po kodzie lojalnościowym")
def lookup_client(
    loyalty_code: str,
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    settings = _get_or_create_settings(current_cafe.id, db)
    if not settings.enabled:
        raise HTTPException(400, detail="Program lojalnościowy jest wyłączony.")

    client = _find_client_by_code(loyalty_code, db)
    cl = (
        db.query(ClientLoyalty)
        .filter(ClientLoyalty.cafe_id == current_cafe.id, ClientLoyalty.client_id == client.id)
        .first()
    )

    return LoyaltyLookupOut(
        client_nick=client.nick,
        full_name=client.full_name,
        loyalty_code=client.loyalty_code,
        mode=settings.mode,
        points=cl.points if cl else 0,
        stamps=cl.stamps if cl else 0,
        stamps_max=settings.stamps_max,
        rewards=settings.rewards,
    )


# ══════════════════════════════════════════════════════════════════════════════
# PUNKTY — doliczenie za transakcję / wymiana na nagrodę
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/earn", response_model=LoyaltyBalanceOut,
             summary="Dolicz punkty za kwotę transakcji (10 gr = 3 pkt.)")
def earn_points(
    payload:      LoyaltyEarnIn,
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    settings = _get_or_create_settings(current_cafe.id, db)
    if not settings.enabled or settings.mode != "points":
        raise HTTPException(400, detail="Ta kawiarnia nie korzysta z punktowego programu lojalnościowego.")

    client = _find_client_by_code(payload.loyalty_code, db)
    cl = _get_or_create_client_loyalty(current_cafe.id, client.id, db)

    grosze = round(payload.amount * 100)
    earned = (grosze // 10) * 3

    cl.points     += earned
    cl.updated_at  = datetime.utcnow()
    db.add(LoyaltyTransaction(
        cafe_id=current_cafe.id, client_id=client.id, kind="earn_points",
        description=f"Transakcja {payload.amount:.2f} zł ({earned} pkt.)",
        points_delta=earned,
    ))
    db.commit()
    db.refresh(cl)

    return LoyaltyBalanceOut(
        client_nick=client.nick, mode=settings.mode,
        points=cl.points, stamps=cl.stamps, stamps_max=settings.stamps_max,
    )


@router.post("/redeem", response_model=LoyaltyBalanceOut,
             summary="Wymień punkty klienta na nagrodę")
def redeem_reward(
    payload:      LoyaltyRedeemIn,
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    settings = _get_or_create_settings(current_cafe.id, db)
    if not settings.enabled or settings.mode != "points":
        raise HTTPException(400, detail="Ta kawiarnia nie korzysta z punktowego programu lojalnościowego.")

    reward = next((r for r in settings.rewards if r.id == payload.reward_id), None)
    if not reward:
        raise HTTPException(404, detail="Nagroda nie istnieje.")

    client = _find_client_by_code(payload.loyalty_code, db)
    cl = _get_or_create_client_loyalty(current_cafe.id, client.id, db)

    if cl.points < reward.cost_points:
        raise HTTPException(
            400,
            detail=f"Za mało punktów — potrzeba {reward.cost_points}, dostępne {cl.points}.",
        )

    cl.points    -= reward.cost_points
    cl.updated_at = datetime.utcnow()
    db.add(LoyaltyTransaction(
        cafe_id=current_cafe.id, client_id=client.id, kind="redeem_points",
        description=f"Wymiana: {reward.name}",
        points_delta=-reward.cost_points,
    ))
    db.commit()
    db.refresh(cl)

    return LoyaltyBalanceOut(
        client_nick=client.nick, mode=settings.mode,
        points=cl.points, stamps=cl.stamps, stamps_max=settings.stamps_max,
    )


# ══════════════════════════════════════════════════════════════════════════════
# PIECZĄTKI CYFROWE
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/stamp/add", response_model=LoyaltyBalanceOut,
             summary="Dodaj kolejną pieczątkę klientowi")
def add_stamp(
    payload:      LoyaltyStampActionIn,
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    settings = _get_or_create_settings(current_cafe.id, db)
    if not settings.enabled or settings.mode != "stamps":
        raise HTTPException(400, detail="Ta kawiarnia nie korzysta z systemu pieczątek.")

    client = _find_client_by_code(payload.loyalty_code, db)
    cl = _get_or_create_client_loyalty(current_cafe.id, client.id, db)

    if cl.stamps >= settings.stamps_max:
        raise HTTPException(400, detail="Karta jest już zapełniona — użyj opcji „Zeruj”.")

    cl.stamps    += 1
    cl.updated_at = datetime.utcnow()
    db.add(LoyaltyTransaction(
        cafe_id=current_cafe.id, client_id=client.id, kind="add_stamp",
        description="Nowa pieczątka", stamps_delta=1,
    ))
    db.commit()
    db.refresh(cl)

    return LoyaltyBalanceOut(
        client_nick=client.nick, mode=settings.mode,
        points=cl.points, stamps=cl.stamps, stamps_max=settings.stamps_max,
    )


@router.post("/stamp/reset", response_model=LoyaltyBalanceOut,
             summary="Wyzeruj kartę pieczątek po odebraniu nagrody")
def reset_stamps(
    payload:      LoyaltyStampActionIn,
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    settings = _get_or_create_settings(current_cafe.id, db)
    if not settings.enabled or settings.mode != "stamps":
        raise HTTPException(400, detail="Ta kawiarnia nie korzysta z systemu pieczątek.")

    client = _find_client_by_code(payload.loyalty_code, db)
    cl = _get_or_create_client_loyalty(current_cafe.id, client.id, db)

    if cl.stamps < settings.stamps_max:
        raise HTTPException(400, detail="Karta nie jest jeszcze zapełniona.")

    cl.stamps    = 0
    cl.updated_at = datetime.utcnow()
    db.add(LoyaltyTransaction(
        cafe_id=current_cafe.id, client_id=client.id, kind="reset_stamps",
        description="Odebrano nagrodę — karta wyzerowana",
    ))
    db.commit()
    db.refresh(cl)

    return LoyaltyBalanceOut(
        client_nick=client.nick, mode=settings.mode,
        points=cl.points, stamps=cl.stamps, stamps_max=settings.stamps_max,
    )


# ══════════════════════════════════════════════════════════════════════════════
# KLIENT — własny kod lojalnościowy
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/me", response_model=ClientLoyaltyCodeOut,
            summary="Pobierz własny kod lojalnościowy (QR)")
def get_my_code(current_client: Client = Depends(get_current_client)):
    return ClientLoyaltyCodeOut(loyalty_code=current_client.loyalty_code)


# ══════════════════════════════════════════════════════════════════════════════
# KLIENT — "Moje kawiarnie"
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/client/mine", response_model=ClientCafeLoyaltyListOut,
            summary="Pobierz status lojalnościowy klienta we wszystkich kawiarniach")
def list_my_loyalty(
    current_client: Client  = Depends(get_current_client),
    db:             Session = Depends(get_db),
):
    rows = (
        db.query(ClientLoyalty)
        .filter(ClientLoyalty.client_id == current_client.id)
        .all()
    )
    if not rows:
        return ClientCafeLoyaltyListOut(cafes=[])

    cafe_ids = [r.cafe_id for r in rows]
    cafes = {c.id: c for c in db.query(Cafe).filter(Cafe.id.in_(cafe_ids)).all()}
    settings_map = {
        s.cafe_id: s
        for s in (
            db.query(LoyaltySettings)
            .options(selectinload(LoyaltySettings.rewards))
            .filter(LoyaltySettings.cafe_id.in_(cafe_ids))
            .all()
        )
    }
    profiles = {
        p.cafe_id: p
        for p in db.query(CafeProfile).filter(CafeProfile.cafe_id.in_(cafe_ids)).all()
    }

    result: list[ClientCafeLoyaltyOut] = []
    for r in rows:
        cafe = cafes.get(r.cafe_id)
        if not cafe:
            continue
        s = settings_map.get(r.cafe_id)
        profile = profiles.get(r.cafe_id)
        logo_url = f"/profile/logo/{cafe.id}" if profile and profile.logo_path else None

        result.append(ClientCafeLoyaltyOut(
            cafe_id=cafe.id,
            cafe_name=cafe.cafe_name,
            logo_url=logo_url,
            mode=(s.mode if s else "points"),
            points=r.points,
            stamps=r.stamps,
            stamps_max=(s.stamps_max if s else 10),
            rewards=(s.rewards if s else []),
        ))

    return ClientCafeLoyaltyListOut(cafes=result)