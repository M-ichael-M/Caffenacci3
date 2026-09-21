from __future__ import annotations

import random
import string
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token, decode_access_token
from app.core.emailer import send_employee_invite_email
from app.models.cafe import Cafe
from app.models.cafe_profile import CafeProfile, ProfileEmployee
from app.models.order import OrderSettings
from app.models.reservation import ReservationSettings
from app.models.loyalty import LoyaltySettings
from app.schemas.employee_auth import (
    EmployeeLoginIn, EmployeeLoginOut, EmployeeVerifyOut, InviteSentOut,
)

router = APIRouter(prefix="/employee-auth", tags=["employee-auth"])
bearer_scheme = HTTPBearer()

INVITE_CODE_TTL_MINUTES = 30
CODE_ALPHABET = string.ascii_uppercase + string.digits


def _generate_code(db: Session, *, check_employee: bool, check_cafe: bool) -> str:
    while True:
        code = "".join(random.choices(CODE_ALPHABET, k=8))
        exists = False
        if check_employee:
            exists = exists or db.query(ProfileEmployee).filter(ProfileEmployee.invite_code == code).first()
        if check_cafe:
            exists = exists or db.query(Cafe).filter(Cafe.staff_code == code).first()
        if not exists:
            return code


def ensure_staff_code(cafe: Cafe, db: Session) -> str:
    if not cafe.staff_code:
        cafe.staff_code = _generate_code(db, check_employee=False, check_cafe=True)
        db.commit()
        db.refresh(cafe)
    return cafe.staff_code


# ── Właściciel: zaproś / usuń dostęp ────────────────────────────────────────
# (montowane pod /profile w main.py, ale trzymane tutaj razem z resztą logiki)

def get_current_cafe_owner(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Cafe:
    payload = decode_access_token(credentials.credentials)
    if not payload or payload.get("role") == "employee":
        raise HTTPException(status_code=401, detail="Nieprawidłowy lub wygasły token.")
    cafe = db.query(Cafe).filter(Cafe.id == payload.get("sub")).first()
    if not cafe:
        raise HTTPException(status_code=404, detail="Kawiarnia nie znaleziona.")
    return cafe


@router.post("/employees/{employee_id}/invite", response_model=InviteSentOut,
             summary="Wyślij (lub wyślij ponownie) zaproszenie do aplikacji pracowniczej")
def invite_employee(
    employee_id: str,
    current_cafe: Cafe = Depends(get_current_cafe_owner),
    db: Session = Depends(get_db),
):
    employee = (
        db.query(ProfileEmployee)
        .join(CafeProfile, ProfileEmployee.profile_id == CafeProfile.id)
        .filter(ProfileEmployee.id == employee_id, CafeProfile.cafe_id == current_cafe.id)
        .first()
    )
    if not employee:
        raise HTTPException(404, detail="Pracownik nie istnieje.")
    if not employee.email:
        raise HTTPException(400, detail="Ten pracownik nie ma przypisanego adresu e-mail.")

    employee.invite_code = _generate_code(db, check_employee=True, check_cafe=False)
    employee.invite_code_expires_at = datetime.utcnow() + timedelta(minutes=INVITE_CODE_TTL_MINUTES)
    employee.invited_at = datetime.utcnow()
    db.commit()

    send_employee_invite_email(employee.email, current_cafe.cafe_name, employee.invite_code)
    return InviteSentOut()


@router.delete("/employees/{employee_id}/access", status_code=status.HTTP_204_NO_CONTENT,
               summary="Usuń dostęp pracownika do aplikacji")
def revoke_employee_access(
    employee_id: str,
    current_cafe: Cafe = Depends(get_current_cafe_owner),
    db: Session = Depends(get_db),
):
    employee = (
        db.query(ProfileEmployee)
        .join(CafeProfile, ProfileEmployee.profile_id == CafeProfile.id)
        .filter(ProfileEmployee.id == employee_id, CafeProfile.cafe_id == current_cafe.id)
        .first()
    )
    if not employee:
        raise HTTPException(404, detail="Pracownik nie istnieje.")
    employee.access_enabled = False
    employee.invite_code = None
    employee.invite_code_expires_at = None
    db.commit()


# ── Pracownik: logowanie i weryfikacja ──────────────────────────────────────

@router.post("/login", response_model=EmployeeLoginOut, summary="Logowanie pracownika w aplikacji mobilnej")
def employee_login(payload: EmployeeLoginIn, db: Session = Depends(get_db)):
    cafe = db.query(Cafe).filter(Cafe.staff_code == payload.cafe_code.strip().upper()).first()
    if not cafe:
        raise HTTPException(401, detail="Nieprawidłowy kod kawiarni.")

    employee = (
        db.query(ProfileEmployee)
        .join(CafeProfile, ProfileEmployee.profile_id == CafeProfile.id)
        .filter(
            CafeProfile.cafe_id == cafe.id,
            ProfileEmployee.invite_code == payload.employee_code.strip().upper(),
        )
        .first()
    )
    if not employee:
        raise HTTPException(401, detail="Nieprawidłowy kod pracownika.")

    if not employee.access_enabled:
        if not employee.invite_code_expires_at or datetime.utcnow() > employee.invite_code_expires_at:
            raise HTTPException(
                401,
                detail="Kod zaproszenia wygasł. Poproś właściciela kawiarni o nowe zaproszenie.",
            )
        employee.access_enabled = True
        employee.access_granted_at = datetime.utcnow()
        db.commit()
        db.refresh(employee)

    token = create_access_token(data={"sub": employee.id, "role": "employee"})
    return EmployeeLoginOut(
        access_token=token,
        employee_id=employee.id,
        full_name=employee.full_name,
        role=employee.role,
        cafe_id=cafe.id,
        cafe_name=cafe.cafe_name,
    )


@router.get("/verify", response_model=EmployeeVerifyOut,
            summary="Sprawdź czy pracownik nadal ma dostęp (wywoływane przy każdym otwarciu aplikacji)")
def employee_verify(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    payload = decode_access_token(credentials.credentials)
    if not payload or payload.get("role") != "employee":
        raise HTTPException(401, detail="Nieprawidłowy lub wygasły token.")

    employee = db.query(ProfileEmployee).filter(ProfileEmployee.id == payload.get("sub")).first()
    if not employee or not employee.access_enabled:
        raise HTTPException(401, detail="Dostęp pracownika został cofnięty.")

    profile = db.query(CafeProfile).filter(CafeProfile.id == employee.profile_id).first()
    if not profile:
        raise HTTPException(404, detail="Kawiarnia nie znaleziona.")
    cafe = db.query(Cafe).filter(Cafe.id == profile.cafe_id).first()
    if not cafe:
        raise HTTPException(404, detail="Kawiarnia nie znaleziona.")

    order_settings = db.query(OrderSettings).filter(OrderSettings.cafe_id == cafe.id).first()
    res_settings = db.query(ReservationSettings).filter(ReservationSettings.cafe_id == cafe.id).first()
    loyalty_settings = db.query(LoyaltySettings).filter(LoyaltySettings.cafe_id == cafe.id).first()

    return EmployeeVerifyOut(
        employee_id=employee.id,
        full_name=employee.full_name,
        role=employee.role,
        cafe_id=cafe.id,
        cafe_name=cafe.cafe_name,
        loyalty_enabled=bool(loyalty_settings and loyalty_settings.enabled),
        orders_enabled=bool(order_settings and order_settings.enabled),
        reservations_enabled=bool(res_settings and res_settings.enabled),
    )