from __future__ import annotations
from pydantic import BaseModel, Field
from typing import List, Optional


# ── Nagrody (system punktowy) ────────────────────────────────────────────

class LoyaltyRewardIn(BaseModel):
    name:        str = Field(..., min_length=1, max_length=200)
    cost_points: int = Field(..., ge=1)
    position:    int = Field(0, ge=0)


class LoyaltyRewardOut(LoyaltyRewardIn):
    id: str
    model_config = {"from_attributes": True}


# ── Ustawienia programu (właściciel) ─────────────────────────────────────

class LoyaltySettingsIn(BaseModel):
    enabled:            bool = False
    mode:               str  = Field("points", pattern=r"^(points|stamps)$")
    stamps_max:         int  = Field(10, ge=2, le=100)
    stamps_earn_desc:   Optional[str] = Field(None, max_length=500)
    stamps_reward_desc: Optional[str] = Field(None, max_length=500)
    rewards:            List[LoyaltyRewardIn] = []


class LoyaltySettingsOut(BaseModel):
    id:                 str
    cafe_id:            str
    enabled:            bool
    mode:               str
    stamps_max:         int
    stamps_earn_desc:   Optional[str]
    stamps_reward_desc: Optional[str]
    rewards:            List[LoyaltyRewardOut] = []
    model_config = {"from_attributes": True}


# ── Kasa — wyszukanie klienta po kodzie lojalnościowym ───────────────────

class LoyaltyLookupOut(BaseModel):
    client_nick:  str
    full_name:    str
    loyalty_code: str
    mode:         str
    points:       int = 0
    stamps:       int = 0
    stamps_max:   int = 10
    rewards:      List[LoyaltyRewardOut] = []


class LoyaltyEarnIn(BaseModel):
    loyalty_code: str   = Field(..., min_length=8, max_length=8)
    amount:       float = Field(..., gt=0)


class LoyaltyRedeemIn(BaseModel):
    loyalty_code: str = Field(..., min_length=8, max_length=8)
    reward_id:    str


class LoyaltyStampActionIn(BaseModel):
    loyalty_code: str = Field(..., min_length=8, max_length=8)


class LoyaltyBalanceOut(BaseModel):
    client_nick: str
    mode:        str
    points:      int = 0
    stamps:      int = 0
    stamps_max:  int = 10


# ── Klient: własny kod lojalnościowy ─────────────────────────────────────

class ClientLoyaltyCodeOut(BaseModel):
    loyalty_code: str


# ── Klient: "Moje kawiarnie" ─────────────────────────────────────────────

class ClientCafeLoyaltyOut(BaseModel):
    cafe_id:    str
    cafe_name:  str
    logo_url:   Optional[str] = None
    mode:       str
    points:     int = 0
    stamps:     int = 0
    stamps_max: int = 10
    rewards:    List[LoyaltyRewardOut] = []


class ClientCafeLoyaltyListOut(BaseModel):
    cafes: List[ClientCafeLoyaltyOut]