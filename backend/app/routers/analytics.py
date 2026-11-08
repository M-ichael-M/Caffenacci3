from __future__ import annotations

import json
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core import analytics as svc
from app.core.database import SessionLocal, get_db
from app.core.translations import get_settings
from app.models.cafe import Cafe
from app.routers.employee_auth import get_current_cafe_owner

router = APIRouter(prefix="/analytics", tags=["analytics"])


class CollectIn(BaseModel):
    cafe_id: str = Field(..., max_length=36)
    type: Literal["pageview", "event"]
    name: Optional[str] = Field(None, max_length=30)
    dim:  Optional[str] = Field(None, max_length=30)
    ref:  Optional[str] = Field(None, max_length=300)
    src:  Optional[str] = Field(None, max_length=20)


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return (fwd.split(",")[0].strip() if fwd else "") or (request.client.host if request.client else "")


def _handle(p: CollectIn, ip: str, ua: str) -> None:
    db = SessionLocal()
    try:
        tz_name = svc.cafe_timezone(db, p.cafe_id)
        if tz_name is None:          # nieistniejąca / nieopublikowana kawiarnia
            return
        svc.record(db, cafe_id=p.cafe_id, tz_name=tz_name, kind=p.type, ip=ip, ua=ua,
                   name=p.name, dim=p.dim, ref=p.ref, src=p.src)
    finally:
        db.close()


@router.post("/collect", status_code=204, include_in_schema=False)
async def collect(request: Request):
    """Publiczny, zawsze 204 (nie zdradzamy powodów odrzucenia).
    Przyjmuje text/plain, żeby sendBeacon nie wywoływał preflightu CORS."""
    if request.headers.get("dnt") == "1" or request.headers.get("sec-gpc") == "1":
        return Response(status_code=204)
    try:
        raw = await request.body()
        if len(raw) > 2048:
            return Response(status_code=204)
        payload = CollectIn.model_validate(json.loads(raw))
        await run_in_threadpool(_handle, payload, _client_ip(request), request.headers.get("user-agent", ""))
    except Exception:
        pass
    return Response(status_code=204)


@router.get("/summary", summary="Statystyki ruchu i wpływu Caffenacci (właściciel)")
def summary(
    days: int = Query(30, ge=7, le=365),
    cafe: Cafe = Depends(get_current_cafe_owner),
    db: Session = Depends(get_db),
):
    return svc.build_summary(db, cafe, days, get_settings(cafe.id, db).time_zone)

