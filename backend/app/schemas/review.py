from __future__ import annotations
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class ReviewIn(BaseModel):
    """Formularz publiczny — składany przez klienta."""
    nick:    str = Field(..., min_length=2, max_length=60, examples=["Kasia_W"])
    rating:  int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=1000)
    # Identyfikator konta klienta — opcjonalny (systemu kont jeszcze nie ma).
    # Gdy powstanie, frontend będzie go dołączał automatycznie.
    client_id: Optional[str] = Field(None, max_length=100)


class ReviewOut(BaseModel):
    """Celowo NIE zawiera client_id — ten identyfikator nie jest widoczny dla nikogo."""
    id:         str
    nick:       str
    rating:     int
    comment:    Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class ReviewListOut(BaseModel):
    reviews:        List[ReviewOut]
    average_rating: float
    count:          int


class ReviewSummaryOut(BaseModel):
    average_rating: float
    count:          int