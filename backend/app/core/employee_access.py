from __future__ import annotations
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.cafe import Cafe
from app.models.cafe_profile import CafeProfile, ProfileEmployee

bearer_scheme = HTTPBearer()


def get_current_cafe_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> str:
    """Zwraca cafe_id niezależnie od tego, czy żąda właściciel czy pracownik
    z ważnym dostępem. Używane w endpointach współdzielonych między panelem
    właściciela a aplikacją pracowniczą (odczyt/decyzje, nie ustawienia)."""
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy lub wygasły token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("role") == "employee":
        employee = db.query(ProfileEmployee).filter(ProfileEmployee.id == payload.get("sub")).first()
        if not employee or not employee.access_enabled:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Dostęp pracownika został cofnięty.",
            )
        profile = db.query(CafeProfile).filter(CafeProfile.id == employee.profile_id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Kawiarnia nie znaleziona.")
        return profile.cafe_id

    cafe = db.query(Cafe).filter(Cafe.id == payload.get("sub")).first()
    if not cafe:
        raise HTTPException(status_code=404, detail="Kawiarnia nie znaleziona.")
    return cafe.id