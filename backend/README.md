# Caffenacci – Backend

Backend aplikacji webowej dla kawiarni, zbudowany w **FastAPI + SQLAlchemy**.

## Struktura projektu

```
caffenacci/
├── main.py                  # Punkt wejścia aplikacji
├── requirements.txt
├── .env.example             # Wzór pliku konfiguracyjnego
└── app/
    ├── core/
    │   ├── config.py        # Ustawienia (env vars)
    │   ├── database.py      # Połączenie z bazą danych
    │   └── security.py      # Haszowanie haseł + JWT
    ├── models/
    │   └── cafe.py          # Model SQLAlchemy (tabela cafes)
    ├── schemas/
    │   └── cafe.py          # Schematy Pydantic (walidacja danych)
    └── routers/
        ├── auth.py          # POST /auth/register, POST /auth/login
        └── me.py            # GET /me (chroniony endpoint)
```

## Szybki start

### 1. Utwórz środowisko wirtualne

```bash
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
```

### 2. Zainstaluj zależności

```bash
pip install -r requirements.txt
```

### 3. Skonfiguruj zmienne środowiskowe

```bash
cp .env.example .env
# Edytuj .env i ustaw SECRET_KEY na losowy, długi string
```

### 4. Uruchom serwer

```bash
uvicorn main:app --reload
```

API będzie dostępne pod adresem: **http://localhost:8000**

Dokumentacja Swagger: **http://localhost:8000/docs**

---

## Endpointy

### `POST /auth/register`
Rejestracja nowej kawiarni.

**Body:**
```json
{
  "owner_name": "Jan Kowalski",
  "cafe_name": "Kawiarnia Pod Lipą",
  "email": "jan@kawiarnia.pl",
  "phone": "+48 123 456 789",
  "password": "Mocne#Haslo1",
  "address": {
    "country": "Polska",
    "city": "Warszawa",
    "street": "Marszałkowska",
    "building_number": "12A",
    "postal_code": "00-001"
  }
}
```

**Odpowiedź (201):**
```json
{
  "id": "uuid-kawiarni",
  "cafe_name": "Kawiarnia Pod Lipą",
  "email": "jan@kawiarnia.pl",
  "message": "Konto zostało pomyślnie utworzone."
}
```

---

### `POST /auth/login`
Logowanie właściciela kawiarni.

**Body:**
```json
{
  "email": "jan@kawiarnia.pl",
  "password": "Mocne#Haslo1"
}
```

**Odpowiedź (200):**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "cafe_id": "uuid-kawiarni",
  "cafe_name": "Kawiarnia Pod Lipą",
  "owner_name": "Jan Kowalski"
}
```

---

### `GET /me`
Zwraca profil zalogowanej kawiarni (wymaga tokena JWT).

**Header:** `Authorization: Bearer <access_token>`

---

## Integracja z React

Przechowuj token JWT w `localStorage` lub `sessionStorage` i dołączaj go do każdego chronionego żądania:

```js
// Logowanie
const res = await fetch("http://localhost:8000/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const data = await res.json();
localStorage.setItem("token", data.access_token);

// Chroniony endpoint
const profile = await fetch("http://localhost:8000/me", {
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});
```

---

## Produkcja

- Ustaw `DATABASE_URL` na PostgreSQL, np. `postgresql+psycopg://user:pass@host/dbname`
- Wygeneruj silny `SECRET_KEY`: `openssl rand -hex 32`
- Schemat bazy zmieniaj wyłącznie migracjami Alembic. `create_all` działa tylko
  w development na SQLite.
- Ustaw właściwe `allow_origins` w konfiguracji CORS

## PostgreSQL lokalnie i przeniesienie danych (Windows / PowerShell)

1. Skopiuj `.env.example` do `.env`; ustaw `ENV=development`, `DATABASE_URL`
   na lokalny PostgreSQL oraz silny `SECRET_KEY`. Wartość z przykładu hasła
   Postgresa jest wyłącznie developerska.
2. Uruchom `docker compose -f docker-compose.dev.yml up -d`, a potem sprawdź
   `docker compose -f docker-compose.dev.yml ps` — `postgres` powinien mieć
   status `healthy`.
3. Z aktywnym venv wykonaj `alembic upgrade head`, a potem `alembic current`.
4. W PowerShell ustaw URL dla narzędzia transferu, np. `$pgUrl = "postgresql+psycopg://caffenacci:caffenacci-dev-password@localhost:5432/caffenacci"`.
   Najpierw sprawdź transfer: `python scripts/sqlite_to_postgres.py --sqlite-path .\caffenacci.db --pg-url $pgUrl --dry-run`.
   Jeśli raport nie zawiera błędów, uruchom tę samą komendę z `--apply`.
   Skrypt niczego nie usuwa ze źródła i odmawia kopiowania, gdy tabele celu
   nie są puste. Zrób kopię pliku SQLite przed uruchomieniem.
5. Uruchom `uvicorn main:app --reload`; sprawdź `http://localhost:8000/health`
   i wykonaj kontrolną rejestrację, logowanie, zapis menu, zamówienie,
   rezerwację, opinię, punkty lojalnościowe i publikację strony.

Komendy migracji (z katalogu `backend/`):

```powershell
alembic upgrade head
alembic current
alembic revision --autogenerate -m "opis zmiany"
alembic downgrade -1
```

Po utworzeniu nowej migracji obejrzyj ją i popraw ręcznie, jeśli autogenerowanie
nie uchwyciło zmian. Wdrożenie produkcyjne wykonuje kopię zapasową bazy,
wdraża kod i uruchamia `alembic upgrade head` przed uruchomieniem nowej wersji
aplikacji. Nie używaj `create_all` na produkcji. Dla bazy wypełnionej wcześniejszym
skryptem, która ma już dokładnie schemat migracji bazowej, można oznaczyć ją
   `alembic stamp 0001`, a następnie `alembic upgrade head`, jeśli jej schemat
   odpowiada migracji bazowej. Użyj `alembic stamp head` tylko gdy baza ma już
   również indeksy i rozszerzenia z 0002. Skrypt `sqlite_to_postgres.py` sam
   wymaga `alembic upgrade head`, więc w tym przepływie `stamp` nie jest potrzebny.

Przykład kolejnej migracji: `alembic revision --autogenerate -m "add cafe tagline"`,
przegląd wygenerowanego pliku, a następnie `alembic upgrade head`. Produkcyjnie
wykonuj tę samą migrację na kopii/stagingu, sprawdź czas blokad i kopię zapasową,
a potem uruchom `alembic upgrade head` podczas wdrożenia. Zmiany tabel muszą
być wstecznie zgodne z poprzednią wersją aplikacji, jeśli wdrażanie jest
stopniowe.
