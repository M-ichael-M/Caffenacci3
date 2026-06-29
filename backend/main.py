from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine
from app.models import cafe  # noqa: F401 — rejestruje model w metadanych
from app.models import menu  # noqa: F401 — rejestruje modele menu
from app.routers import auth, me
from app.routers import menu as menu_router

# Tworzenie tabel przy starcie (dla developmentu; na produkcji użyj Alembic)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Caffenacci API",
    description="Backend dla aplikacji webowej kawiarni Caffenacci.",
    version="1.0.0",
)

# CORS – pozwala Reactowi (localhost:5173 / 3000) na komunikację z API
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


@app.get("/", tags=["health"])
def root():
    return {"status": "ok", "service": "Caffenacci API"}