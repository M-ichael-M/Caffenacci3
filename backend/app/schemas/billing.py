from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class SubscriptionStatusOut(BaseModel):
    kind: Optional[str] = None            # None | "subscription" | "promo"
    status: str                            # "none" | "active" | "cancelling" | "expired"
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False
    promo_code: Optional[str] = None
    can_cancel: bool = False
    next_billing_date: Optional[datetime] = None  # tylko dla aktywnej, odnawiającej się subskrypcji


class PromoRedeemIn(BaseModel):
    code: str = Field(..., min_length=2, max_length=50)