from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine
from app.models import cafe         # noqa: F401
from app.models import menu         # noqa: F401
from app.models import reservation  # noqa: F401  ← rejestruje modele rezerwacji
from app.models import cafe_profile # noqa: F401  ← rejestruje modele profilu kawiarni
from app.models import review       # noqa: F401  ← rejestruje model opinii
from app.routers import auth, me
from app.routers import menu as menu_router
from app.routers import reservation as reservation_router
from app.routers import cafe_profile as cafe_profile_router
from app.routers import review as review_router


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Caffenacci API",
    description="Backend dla aplikacji webowej kawiarni Caffenacci.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
    ],
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


@app.get("/", tags=["health"])
def root():
    return {"status": "ok", "service": "Caffenacci API"}