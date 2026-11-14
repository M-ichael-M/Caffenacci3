from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db          # ← tego brakowało
from app.core.languages import DEFAULT_PRIMARY_LANGUAGE
from app.core.regions import currency_for_country, valid_time_zone
from app.core.security import create_access_token, hash_password, verify_password
from app.core.slugs import generate_unique_slug
from app.models.cafe import Cafe
from app.models.translation import CafeLanguageSettings
from app.schemas.cafe import LoginIn, RegisterIn, RegisterOut, TokenOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=RegisterOut,
    status_code=status.HTTP_201_CREATED,
    summary="Rejestracja nowej kawiarni",
)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    # Sprawdź unikalność emaila
    existing = db.query(Cafe).filter(Cafe.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Konto z podanym adresem email już istnieje.",
        )

    cafe = Cafe(
        owner_name=payload.owner_name,
        cafe_name=payload.cafe_name,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        country=payload.address.country,
        city=payload.address.city,
        street=payload.address.street,
        building_number=payload.address.building_number,
        postal_code=payload.address.postal_code,
    )
    cafe.slug = generate_unique_slug(payload.cafe_name, payload.address.city, db)

    from app.routers.employee_auth import _generate_code
    cafe.staff_code = _generate_code(db, check_employee=False, check_cafe=True)

    db.add(cafe)
    db.flush()          # id kawiarni potrzebne do wiersza ustawień
    db.add(CafeLanguageSettings(
        cafe_id=cafe.id,
        primary_language=DEFAULT_PRIMARY_LANGUAGE,
        currency=currency_for_country(payload.address.country),
        time_zone=valid_time_zone(payload.time_zone),
        region_confirmed=False,
    ))
    db.commit()
    db.refresh(cafe)

    return RegisterOut(
        id=cafe.id,
        cafe_name=cafe.cafe_name,
        email=cafe.email,
    )


@router.post(
    "/login",
    response_model=TokenOut,
    summary="Logowanie właściciela kawiarni",
)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    cafe = db.query(Cafe).filter(Cafe.email == payload.email).first()

    if not cafe or not verify_password(payload.password, cafe.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy email lub hasło.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(data={"sub": cafe.id, "email": cafe.email})

    return TokenOut(
        access_token=token,
        cafe_id=cafe.id,
        cafe_name=cafe.cafe_name,
        owner_name=cafe.owner_name,
    )
