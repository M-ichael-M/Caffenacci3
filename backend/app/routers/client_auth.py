from __future__ import annotations

import random
import string

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.models.client import Client
from app.schemas.client import (
    ClientRegisterIn, ClientRegisterOut,
    ClientLoginIn, ClientTokenOut,
    ClientProfileOut, NickAvailabilityOut,
)

router = APIRouter(prefix="/client-auth", tags=["client-auth"])
bearer_scheme = HTTPBearer()


# ── Kod lojalnościowy ─────────────────────────────────────────────────────
# 8 znaków, litery (wielkie) + cyfry. Niezależny od `id` klienta — to on
# jest pokazywany klientowi (w formie kodu QR) i wpisywany przez obsługę
# kawiarni przy kasie w systemie lojalnościowym.

LOYALTY_CODE_ALPHABET = string.ascii_uppercase + string.digits


def _generate_loyalty_code(db: Session) -> str:
    while True:
        code = "".join(random.choices(LOYALTY_CODE_ALPHABET, k=8))
        exists = db.query(Client).filter(Client.loyalty_code == code).first()
        if not exists:
            return code


# ── Auth helper (do wykorzystania w przyszłych publicznych/klienckich endpointach:
#    rezerwacje, opinie, zamówienia — żeby automatycznie dołączać client_id) ──────

def get_current_client(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Client:
    payload = decode_access_token(credentials.credentials)
    if not payload or payload.get("role") != "client":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy lub wygasły token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    client = db.query(Client).filter(Client.id == payload.get("sub")).first()
    if not client:
        raise HTTPException(status_code=404, detail="Użytkownik nie został znaleziony.")
    return client


# ══════════════════════════════════════════════════════════════════════════════
# SPRAWDZENIE DOSTĘPNOŚCI NICKU (na żywo w formularzu rejestracji)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/nick-available", response_model=NickAvailabilityOut,
            summary="Sprawdź czy nick jest dostępny")
def check_nick(nick: str, db: Session = Depends(get_db)):
    exists = db.query(Client).filter(func.lower(Client.nick) == nick.strip().lower()).first()
    return NickAvailabilityOut(nick=nick, available=exists is None)


# ══════════════════════════════════════════════════════════════════════════════
# REJESTRACJA
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/register",
    response_model=ClientRegisterOut,
    status_code=status.HTTP_201_CREATED,
    summary="Rejestracja nowego użytkownika",
)
def register(payload: ClientRegisterIn, db: Session = Depends(get_db)):
    existing_email = db.query(Client).filter(Client.email == payload.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Konto z podanym adresem email już istnieje.",
        )

    existing_nick = (
        db.query(Client)
        .filter(func.lower(Client.nick) == payload.nick.lower())
        .first()
    )
    if existing_nick:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ten nick jest już zajęty. Wybierz inny.",
        )

    client = Client(
        full_name=payload.full_name,
        nick=payload.nick,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        accepted_terms=payload.accept_terms,
        accepted_privacy=payload.accept_privacy,
        loyalty_code=_generate_loyalty_code(db),
    )

    db.add(client)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Konto z podanym adresem email lub nickiem już istnieje.",
        )
    db.refresh(client)

    return ClientRegisterOut(id=client.id, nick=client.nick, email=client.email)


# ══════════════════════════════════════════════════════════════════════════════
# LOGOWANIE
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/login",
    response_model=ClientTokenOut,
    summary="Logowanie użytkownika",
)
def login(payload: ClientLoginIn, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.email == payload.email).first()

    if not client or not verify_password(payload.password, client.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy email lub hasło.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(data={"sub": client.id, "email": client.email, "role": "client"})

    return ClientTokenOut(
        access_token=token,
        user_id=client.id,
        nick=client.nick,
        full_name=client.full_name,
    )


# ══════════════════════════════════════════════════════════════════════════════
# PROFIL ZALOGOWANEGO UŻYTKOWNIKA
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/me", response_model=ClientProfileOut, summary="Pobierz profil zalogowanego użytkownika")
def get_profile(current_client: Client = Depends(get_current_client)):
    return current_client