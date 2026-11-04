import logging
import secrets
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

log = logging.getLogger("caffenacci.config")

_DEV_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
_WEAK_KEYS = ("zmien-to", "dev-secret", "changeme")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Domyślnie production = fail-safe; w dev ustaw ENV=development w .env
    ENV: Literal["development", "production"] = "production"

    DATABASE_URL: str = "sqlite:///./caffenacci.db"
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Lista po przecinku: https://a.pl,https://b.pl (puste = wartości z URL-i poniżej / dev)
    CORS_ORIGINS: str = ""
    PUBLIC_SITE_URL: str = "http://localhost:5174"   # caffenacci.customer
    COMPANY_APP_URL: str = "http://localhost:5173"   # caffenacci.company (panel)
    API_PUBLIC_URL: str = "http://localhost:8000"
    PLAY_STORE_URL: str | None = None
    # Ścieżka do zbudowanego klienta (caffenacci.customer/dist). Źródło szablonu
    # HTML dla /kawiarnia/{slug}; jeśli ustawione, backend serwuje też /assets.
    CUSTOMER_DIST_DIR: str | None = None

    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_STARTTLS: bool = True
    EMAIL_BACKEND: Literal["console", "smtp"] = "console"
    EMAIL_FROM_NAME: str = "Caffenacci"
    EMAIL_FROM_ADDRESS: str = "noreply@localhost"
    STORAGE_BACKEND: Literal["local"] = "local"
    STORAGE_LOCAL_DIR: str = "uploads/"
    IMAGE_PROCESSING_CONCURRENCY: int = 2
    RUN_SCHEDULER: bool = True
    ENABLE_APP_GZIP: bool | None = None
    PUBLIC_CACHE_S_MAXAGE: int = 120
    PAGE_CACHE_TTL: int = 60

    @property
    def app_gzip_enabled(self) -> bool:
        return self.ENABLE_APP_GZIP if self.ENABLE_APP_GZIP is not None else not self.is_production

    @property
    def is_production(self) -> bool:
        return self.ENV == "production"

    @property
    def cors_origins_list(self) -> list[str]:
        explicit = [o.strip().rstrip("/") for o in self.CORS_ORIGINS.split(",") if o.strip()]
        if self.is_production:
            if explicit:
                return explicit
            return [self.PUBLIC_SITE_URL.rstrip("/"), self.COMPANY_APP_URL.rstrip("/")]
        # In development, retain explicit frontend origins and allow the local
        # host/port variants used when serving the customer build from FastAPI.
        return list(dict.fromkeys([*explicit, *_DEV_ORIGINS]))

    @model_validator(mode="after")
    def _validate(self):
        if not self.SECRET_KEY:
            if self.is_production:
                raise ValueError("SECRET_KEY jest wymagany (ustaw go w .env / zmiennych srodowiska).")
            self.SECRET_KEY = secrets.token_hex(32)
            log.warning("SECRET_KEY nie ustawiony - wygenerowano losowy klucz (tokeny uniewaznia sie przy restarcie).")

        if self.is_production:
            problems = []
            if len(self.SECRET_KEY) < 32 or any(w in self.SECRET_KEY.lower() for w in _WEAK_KEYS):
                problems.append("SECRET_KEY jest za krotki (<32) lub wyglada na przykladowy.")
            urls = [*self.cors_origins_list, self.PUBLIC_SITE_URL, self.COMPANY_APP_URL, self.API_PUBLIC_URL]
            if any("localhost" in u or "127.0.0.1" in u for u in urls):
                problems.append("CORS_ORIGINS/PUBLIC_SITE_URL/COMPANY_APP_URL/API_PUBLIC_URL wskazuja na localhost.")
            if problems:
                raise ValueError("Bledna konfiguracja produkcyjna: " + " ".join(problems))
            if self.DATABASE_URL.startswith("sqlite"):
                log.warning("Produkcja na SQLite - rozwaz PostgreSQL.")
        return self


settings = Settings()
