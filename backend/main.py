from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
import hashlib
from starlette.responses import Response
from datetime import datetime, timezone

from app.core.config import settings
from app.core.database import Base, engine, get_db
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException
from app.models import cafe         # noqa: F401
from app.models import menu         # noqa: F401
from app.models import reservation  # noqa: F401
from app.models import cafe_profile # noqa: F401
from app.models import review       # noqa: F401
from app.models import order        # noqa: F401
from app.models import client       # noqa: F401
from app.models import site         # noqa: F401
from app.models import gallery      # noqa: F401
from app.models import loyalty      # noqa: F401
from app.models import news         # noqa: F401
from app.models import slug_history # noqa: F401
from app.models import billing      # noqa: F401  ← rejestruje model subskrypcji
from app.routers import auth, me
from app.routers import menu as menu_router
from app.routers import reservation as reservation_router
from app.routers import cafe_profile as cafe_profile_router
from app.routers import review as review_router
from app.routers import order as order_router
from app.routers import client_auth as client_auth_router
from app.routers import cafe_search as cafe_search_router
from app.routers import billing as billing_router
from app.routers import site as site_router
from app.routers import loyalty as loyalty_router
from app.routers import news as news_router
from app.routers import employee_auth as employee_auth_router
from app.routers import seo as seo_router
from app.core.compression import SelectiveGZipMiddleware
from app.core.jobs import run_expiration_job

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = None
    if settings.RUN_SCHEDULER:
        scheduler = BackgroundScheduler()
        scheduler.add_job(run_expiration_job, "interval", minutes=5, id="expire-stale",
            next_run_time = datetime.now(timezone.utc),  # pierwszy bieg od razu, w wątku schedulera
            max_instances = 1, coalesce = True)
        scheduler.start()
        run_expiration_job()
    yield
    if scheduler:
        scheduler.shutdown(wait=False)


if settings.ENV == "development" and engine.dialect.name == "sqlite":
    Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Caffenacci API",
    description="Backend dla aplikacji webowej kawiarni Caffenacci.",
    version="1.0.0",
    lifespan=lifespan,
)


if settings.app_gzip_enabled:
    app.add_middleware(SelectiveGZipMiddleware, minimum_size=500)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def auth_no_store(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/site/preview/"):
        response.headers["Cache-Control"] = "private, no-store"
        return response
    public_json = not request.headers.get("authorization") and request.method == "GET" and (
        request.url.path.startswith(("/site/public/", "/reviews/public/", "/menu/public/"))
        or request.url.path in ("/cafes/search", "/cafes/all")
    )
    if public_json and response.status_code == 200 and "application/json" in response.headers.get("content-type", ""):
        body = b"".join([chunk async for chunk in response.body_iterator])
        etag = '"' + hashlib.sha256(body).hexdigest()[:32] + '"'
        headers = dict(response.headers)
        headers["ETag"] = etag
        headers["Cache-Control"] = "public, max-age=30"
        condition = request.headers.get("if-none-match", "")
        tags = [tag.strip().removeprefix("W/") for tag in condition.split(",")]
        if "*" in tags or etag in tags:
            headers.pop("content-length", None)
            return Response(status_code=304, headers=headers)
        return Response(body, status_code=response.status_code, headers=headers, media_type=response.media_type)
    if request.headers.get("authorization") and "cache-control" not in response.headers:
        response.headers["Cache-Control"] = "private, no-store"
    return response

app.include_router(auth.router)
app.include_router(me.router)
app.include_router(menu_router.router)
app.include_router(reservation_router.router)
app.include_router(cafe_profile_router.router)
app.include_router(review_router.router)
app.include_router(order_router.router)
app.include_router(client_auth_router.router)
app.include_router(cafe_search_router.router)
app.include_router(billing_router.router)
app.include_router(site_router.router)
app.include_router(loyalty_router.router)
app.include_router(news_router.router)
app.include_router(employee_auth_router.router)
app.include_router(seo_router.router)

# Tylko do lokalnych testów; na produkcji /assets serwuje nginx.
if settings.CUSTOMER_DIST_DIR:
    _assets_dir = Path(settings.CUSTOMER_DIST_DIR) / "assets"
    if _assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="customer-assets")

@app.get("/", tags=["health"])
def root():
    return {"status": "ok", "service": "Caffenacci API"}


@app.get("/health", tags=["health"])
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}
    except Exception as exc:
        raise HTTPException(status_code=503, detail="database unavailable") from exc
