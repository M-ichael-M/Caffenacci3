from pydantic import BaseModel, Field
from typing import List, Optional


# ── Items ──────────────────────────────────────────────────────────────

class MenuItemIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    price: float = Field(..., ge=0)
    position: int = Field(0, ge=0)
    is_vege: bool = False
    is_hot: bool = False
    is_unavailable: bool = False


class MenuItemOut(MenuItemIn):
    id: str

    model_config = {"from_attributes": True}


# ── Sections ───────────────────────────────────────────────────────────

class MenuSectionIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    position: int = Field(0, ge=0)
    items: List[MenuItemIn] = []


class MenuSectionOut(BaseModel):
    id: str
    name: str
    position: int
    items: List[MenuItemOut] = []

    model_config = {"from_attributes": True}


# ── Full menu save (replace-all) ───────────────────────────────────────

class MenuSaveIn(BaseModel):
    sections: List[MenuSectionIn]


class MenuOut(BaseModel):
    cafe_id: str
    sections: List[MenuSectionOut]