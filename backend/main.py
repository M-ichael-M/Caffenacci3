from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine
from app.routers import auth, me

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


@app.get("/", tags=["health"])
def root():
    return {"status": "ok", "service": "Caffenacci API"}
