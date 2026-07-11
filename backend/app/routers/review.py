from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.cafe import Cafe
from app.models.client import Client
from app.models.review import Review
from app.routers.client_auth import get_current_client
from app.schemas.review import ReviewIn, ReviewOut, ReviewListOut, ReviewSummaryOut, ClientReviewIn, ReviewUpdateIn

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
# PUBLICZNY ENDPOINT — klient dodaje opinię (bez logowania — zachowane wstecznie)
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
# OPINIA OD ZALOGOWANEGO KLIENTA — wygenerowana strona kawiarni
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/client/{cafe_id}",
    response_model=ReviewOut,
    status_code=status.HTTP_201_CREATED,
    summary="Dodaj opinię jako zalogowany klient",
)
def create_review_as_client(
    cafe_id: str,
    payload: ClientReviewIn,
    current_client: Client  = Depends(get_current_client),
    db:             Session = Depends(get_db),
):
    cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
    if not cafe:
        raise HTTPException(404, detail="Kawiarnia nie istnieje.")

    existing = (
        db.query(Review)
        .filter(Review.cafe_id == cafe_id, Review.client_id == current_client.id)
        .first()
    )
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Dodałeś już opinię o tej kawiarni.")

    review = Review(
        cafe_id   = cafe_id,
        nick      = current_client.nick,
        rating    = payload.rating,
        comment   = payload.comment,
        client_id = current_client.id,
    )
    db.add(review)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Dodałeś już opinię o tej kawiarni.")
    db.refresh(review)
    return review

# ══════════════════════════════════════════════════════════════════════════════
# WŁASNA OPINIA — sprawdzenie / edycja / usunięcie przez zalogowanego klienta
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/client/{cafe_id}/mine",
    response_model=Optional[ReviewOut],
    summary="Pobierz własną opinię o kawiarni, jeśli istnieje",
)
def get_my_review(
    cafe_id: str,
    current_client: Client  = Depends(get_current_client),
    db:             Session = Depends(get_db),
):
    return (
        db.query(Review)
        .filter(Review.cafe_id == cafe_id, Review.client_id == current_client.id)
        .first()
    )


@router.patch(
    "/client/{review_id}",
    response_model=ReviewOut,
    summary="Edytuj własną opinię",
)
def update_my_review(
    review_id: str,
    payload:   ReviewUpdateIn,
    current_client: Client  = Depends(get_current_client),
    db:             Session = Depends(get_db),
):
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(404, detail="Opinia nie istnieje.")
    if review.client_id != current_client.id:
        raise HTTPException(403, detail="Nie możesz edytować tej opinii.")

    review.rating  = payload.rating
    review.comment = payload.comment
    db.commit()
    db.refresh(review)
    return review


@router.delete(
    "/client/{review_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Usuń własną opinię",
)
def delete_my_review(
    review_id: str,
    current_client: Client  = Depends(get_current_client),
    db:             Session = Depends(get_db),
):
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(404, detail="Opinia nie istnieje.")
    if review.client_id != current_client.id:
        raise HTTPException(403, detail="Nie możesz usunąć tej opinii.")
    db.delete(review)
    db.commit()

# ══════════════════════════════════════════════════════════════════════════════
# PUBLICZNA LISTA OPINII — bez logowania, do wygenerowanej strony kawiarni
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/public/{cafe_id}", response_model=ReviewListOut,
            summary="Pobierz opinie o kawiarni (publiczne)")
def list_reviews_public(cafe_id: str, db: Session = Depends(get_db)):
    cafe = db.query(Cafe).filter(Cafe.id == cafe_id).first()
    if not cafe:
        raise HTTPException(404, detail="Kawiarnia nie istnieje.")

    rows = (
        db.query(Review)
        .filter(Review.cafe_id == cafe_id)
        .order_by(Review.created_at.desc())
        .all()
    )
    avg, count = _aggregate(cafe_id, db)
    return ReviewListOut(reviews=rows, average_rating=avg, count=count)


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
