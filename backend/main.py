from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.database import Base, engine
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


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Caffenacci API",
    description="Backend dla aplikacji webowej kawiarni Caffenacci.",
    version="1.0.0",
)


app.add_middleware(SelectiveGZipMiddleware, minimum_size=500)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
app.add_middleware(SelectiveGZipMiddleware, minimum_size=500)

# Tylko do lokalnych testów; na produkcji /assets serwuje nginx.
if settings.CUSTOMER_DIST_DIR:
    _assets_dir = Path(settings.CUSTOMER_DIST_DIR) / "assets"
    if _assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="customer-assets")

    # Tylko lokalne testy: strona główna klienta (na produkcji robi to nginx).
    @app.get("/", include_in_schema=False)
    def local_customer_home():
        return FileResponse(Path(settings.CUSTOMER_DIST_DIR) / "index.html")


@app.get("/", tags=["health"])
def root():
    return {"status": "ok", "service": "Caffenacci API"}