from __future__ import annotations
from pydantic import BaseModel, Field


class EmployeeLoginIn(BaseModel):
    cafe_code: str = Field(..., min_length=8, max_length=8)
    employee_code: str = Field(..., min_length=8, max_length=8)


class EmployeeLoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    employee_id: str
    full_name: str
    role: str
    cafe_id: str
    cafe_name: str


class EmployeeVerifyOut(BaseModel):
    employee_id: str
    full_name: str
    role: str
    cafe_id: str
    cafe_name: str
    loyalty_enabled: bool
    orders_enabled: bool
    reservations_enabled: bool


class InviteSentOut(BaseModel):
    message: str = "Zaproszenie zostało wysłane."