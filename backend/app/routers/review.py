from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.cafe import Cafe
from app.models.review import Review
from app.schemas.review import ReviewIn, ReviewOut, ReviewListOut, ReviewSummaryOut

router = APIRouter(prefix="/reviews", tags=["reviews"])
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
        raise HTTPException(status_code=404, detail="Kawiarnia nie znaleziona.")
    return cafe


def _aggregate(cafe_id: str, db: Session) -> tuple[float, int]:
    avg, count = (
        db.query(func.avg(Review.rating), func.count(Review.id))
        .filter(Review.cafe_id == cafe_id)
        .first()
    )
    return (round(float(avg), 2) if avg is not None else 0.0, count or 0)


# ══════════════════════════════════════════════════════════════════════════════
# PUBLICZNY ENDPOINT — klient dodaje opinię
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/public/{cafe_id}",
    response_model=ReviewOut,
    status_code=status.HTTP_201_CREATED,
    summary="Dodaj opinię o kawiarni (publiczny)",
)
def create_review(
    cafe_id: str,
    payload: ReviewIn,
    db:      Session = Depends(get_db),
):
    cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
    if not cafe:
        raise HTTPException(404, detail="Kawiarnia nie istnieje.")

    if payload.client_id:
        existing = (
            db.query(Review)
            .filter(Review.cafe_id == cafe_id, Review.client_id == payload.client_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="To konto dodało już opinię o tej kawiarni.",
            )

    review = Review(
        cafe_id   = cafe_id,
        nick      = payload.nick,
        rating    = payload.rating,
        comment   = payload.comment,
        client_id = payload.client_id,
    )
    db.add(review)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="To konto dodało już opinię o tej kawiarni.",
        )
    db.refresh(review)
    return review


# ══════════════════════════════════════════════════════════════════════════════
# LISTA OPINII (właściciel)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("", response_model=ReviewListOut, summary="Pobierz opinie o własnej kawiarni")
def list_reviews(
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    rows = (
        db.query(Review)
        .filter(Review.cafe_id == current_cafe.id)
        .order_by(Review.created_at.desc())
        .all()
    )
    avg, count = _aggregate(current_cafe.id, db)
    return ReviewListOut(reviews=rows, average_rating=avg, count=count)


# ══════════════════════════════════════════════════════════════════════════════
# PODSUMOWANIE — lekki endpoint do zakładki „Przegląd”
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/summary", response_model=ReviewSummaryOut, summary="Średnia ocena + liczba opinii")
def reviews_summary(
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    avg, count = _aggregate(current_cafe.id, db)
    return ReviewSummaryOut(average_rating=avg, count=count)