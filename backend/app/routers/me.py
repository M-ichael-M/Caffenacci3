from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.cafe import Cafe
from app.schemas.cafe import CafeProfile

router = APIRouter(prefix="/me", tags=["me"])
bearer_scheme = HTTPBearer()


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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kawiarnia nie została znaleziona.",
        )
    return cafe


@router.get(
    "",
    response_model=CafeProfile,
    summary="Pobierz profil zalogowanej kawiarni",
)
def get_profile(current_cafe: Cafe = Depends(get_current_cafe)):
    return current_cafe
