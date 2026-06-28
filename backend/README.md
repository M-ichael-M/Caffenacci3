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

- Zmień `DATABASE_URL` na PostgreSQL: `postgresql://user:pass@host/dbname`
- Wygeneruj silny `SECRET_KEY`: `openssl rand -hex 32`
- Zastąp `Base.metadata.create_all` migracjami **Alembic**
- Ustaw właściwe `allow_origins` w konfiguracji CORS
