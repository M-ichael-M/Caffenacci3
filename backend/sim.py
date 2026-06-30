#!/usr/bin/env python3
"""
simulate_reservations.py
────────────────────────
Symuluje rezerwacje składane przez klientów przez publiczny endpoint.

Użycie:
    python simulate_reservations.py                          # tryb interaktywny
    python simulate_reservations.py --cafe-id <UUID>         # podaj ID kawiarni
    python simulate_reservations.py --cafe-id <UUID> --auto  # automatyczne N rezerwacji
    python simulate_reservations.py --login <email> <haslo>  # pobierz cafe_id z logowania

Wymagania:
    pip install requests
"""

import argparse
import json
import random
import sys
from datetime import date, timedelta

try:
    import requests
except ImportError:
    print("Zainstaluj requests: pip install requests")
    sys.exit(1)

BASE_URL = "http://localhost:8000"

# ── Dane testowe ──────────────────────────────────────────────────────────────

NAMES = [
    "Anna Kowalska", "Piotr Nowak", "Maria Wiśniewska", "Tomasz Zieliński",
    "Katarzyna Wójcik", "Marek Kamiński", "Agnieszka Lewandowska", "Jakub Dąbrowski",
    "Monika Szymańska", "Michał Woźniak", "Joanna Kozłowska", "Krzysztof Jankowski",
    "Barbara Mazur", "Łukasz Wojciechowski", "Ewa Kwiatkowska", "Dawid Krawczyk",
]

PHONES = [
    "+48 501 234 567", "+48 602 345 678", "+48 503 456 789", "+48 604 567 890",
    "+48 505 678 901", "+48 606 789 012", None, None,  # część bez telefonu
]

COMMENTS = [
    "Urodziny mojej córki 🎂",
    "Spotkanie biznesowe, prosimy o spokojny stolik",
    "Pierwsza rocznica ślubu ❤️",
    "Wegetarianie — czy menu to uwzględnia?",
    "Przyjdziemy z dzieckiem w wózku",
    "Proszę o stolik przy oknie jeśli możliwe",
    "Obchody awansu — będziemy świętować!",
    None, None, None,  # część bez komentarza
]

TIMES = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"]


def get_cafe_id_from_login(email: str, password: str) -> str:
    """Loguje właściciela i zwraca cafe_id."""
    print(f"\n🔑 Logowanie jako {email}…")
    resp = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": email, "password": password},
    )
    if resp.status_code != 200:
        print(f"❌ Błąd logowania: {resp.json().get('detail', resp.text)}")
        sys.exit(1)
    data = resp.json()
    cafe_id = data["cafe_id"]
    cafe_name = data["cafe_name"]
    print(f"✅ Zalogowano. Kawiarnia: {cafe_name!r}  (ID: {cafe_id})")
    return cafe_id


def check_reservations_enabled(cafe_id: str) -> bool:
    """Sprawdza czy kawiarnia przyjmuje rezerwacje."""
    # Publiczny check — próbujemy złożyć pustą rezerwację i patrzymy na błąd
    # Zamiast tego po prostu informujemy użytkownika
    print(f"\n📍 Cel: {BASE_URL}/reservations/public/{cafe_id}")
    return True


def make_reservation(cafe_id: str, data: dict) -> dict:
    """Składa jedną rezerwację i zwraca wynik."""
    resp = requests.post(
        f"{BASE_URL}/reservations/public/{cafe_id}",
        json=data,
        headers={"Content-Type": "application/json"},
    )
    return {"status_code": resp.status_code, "body": resp.json()}


def random_future_date(days_ahead_min: int = 1, days_ahead_max: int = 14) -> str:
    """Losowa data w przyszłości."""
    delta = random.randint(days_ahead_min, days_ahead_max)
    return (date.today() + timedelta(days=delta)).isoformat()


def print_result(result: dict, data: dict):
    sc = result["status_code"]
    body = result["body"]
    if sc == 201:
        print(f"  ✅ ZŁOŻONO  id={body['id'][:8]}…  {data['date']} {data['start_time']}  "
              f"{data['guests']} os.  '{data['guest_name']}'")
    else:
        detail = body.get("detail", str(body))
        print(f"  ❌ BŁĄD {sc}  {detail}")


# ── Tryb automatyczny ─────────────────────────────────────────────────────────

def run_auto(cafe_id: str, count: int):
    print(f"\n🤖 Automatyczne składanie {count} rezerwacji…\n")
    check_reservations_enabled(cafe_id)

    success = 0
    fail    = 0

    for i in range(count):
        data = {
            "date":        random_future_date(),
            "start_time":  random.choice(TIMES),
            "guests":      random.randint(1, 6),
            "guest_name":  random.choice(NAMES),
            "guest_phone": random.choice(PHONES),
            "guest_email": None,
            "comment":     random.choice(COMMENTS),
        }
        result = make_reservation(cafe_id, data)
        print_result(result, data)
        if result["status_code"] == 201:
            success += 1
        else:
            fail += 1

    print(f"\n📊 Wynik: {success} złożonych, {fail} błędów")


# ── Tryb interaktywny ─────────────────────────────────────────────────────────

def run_interactive(cafe_id: str):
    print(f"\n📝 Interaktywne składanie rezerwacji dla kawiarni {cafe_id[:8]}…")
    print("Wpisz dane lub naciśnij Enter aby użyć podpowiedzi.\n")

    def ask(prompt: str, default: str = "") -> str:
        val = input(f"  {prompt} [{default}]: ").strip()
        return val if val else default

    while True:
        print("─" * 50)
        tomorrow = (date.today() + timedelta(days=1)).isoformat()

        data = {
            "date":       ask("Data (YYYY-MM-DD)", tomorrow),
            "start_time": ask("Godzina (HH:MM)", "12:00"),
            "guests":     int(ask("Liczba gości", "2")),
            "guest_name": ask("Imię i nazwisko", random.choice(NAMES)),
            "guest_phone": ask("Telefon (opcjonalnie)", "") or None,
            "guest_email": ask("E-mail (opcjonalnie)", "") or None,
            "comment":    ask("Komentarz (opcjonalnie)", "") or None,
        }

        print("\n  Wysyłanie…")
        result = make_reservation(cafe_id, data)
        print_result(result, data)

        if result["status_code"] == 201:
            body = result["body"]
            print(f"\n  Szczegóły odpowiedzi:")
            print(f"    ID rezerwacji: {body['id']}")
            print(f"    Status:        {body['status']}")
            print(f"    Gość:          {body['guest_name']}")

        again = input("\n  Złożyć kolejną rezerwację? [T/n]: ").strip().lower()
        if again in ("n", "nie", "no"):
            break

    print("\n✅ Gotowe.")


# ── Podgląd istniejących rezerwacji (przez właściciela) ───────────────────────

def list_pending(email: str, password: str):
    """Loguje się jako właściciel i pokazuje oczekujące rezerwacje."""
    resp = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": email, "password": password},
    )
    if resp.status_code != 200:
        print("❌ Błąd logowania")
        return

    token     = resp.json()["access_token"]
    cafe_name = resp.json()["cafe_name"]

    resp2 = requests.get(
        f"{BASE_URL}/reservations?status=pending",
        headers={"Authorization": f"Bearer {token}"},
    )
    if resp2.status_code != 200:
        print(f"❌ Błąd pobierania: {resp2.text}")
        return

    reservations = resp2.json()["reservations"]
    print(f"\n📋 Oczekujące rezerwacje dla «{cafe_name}»: {len(reservations)}\n")

    if not reservations:
        print("  Brak oczekujących rezerwacji.")
        return

    for r in reservations:
        print(f"  [{r['id'][:8]}…]  {r['date']} {r['start_time']}  "
              f"{r['guests']} os.  {r['guest_name']}"
              + (f"  ☎ {r['guest_phone']}" if r['guest_phone'] else "")
              + (f"  💬 {r['comment']}" if r['comment'] else ""))


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Symulator rezerwacji klientów — Caffenacci",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Przykłady:
  # Podaj ID kawiarni bezpośrednio (znajdziesz je w dashboardzie pod "Identyfikator")
  python simulate_reservations.py --cafe-id abc123

  # Zaloguj się, aby pobrać ID automatycznie
  python simulate_reservations.py --login jan@kawiarnia.pl MojeHaslo1

  # Złóż 5 losowych rezerwacji automatycznie
  python simulate_reservations.py --cafe-id abc123 --auto 5

  # Wyświetl oczekujące rezerwacje (jako właściciel)
  python simulate_reservations.py --pending jan@kawiarnia.pl MojeHaslo1
        """
    )

    parser.add_argument("--cafe-id",  metavar="UUID",  help="ID kawiarni (z dashboardu)")
    parser.add_argument("--login",    nargs=2,         metavar=("EMAIL", "HASLO"),
                        help="Zaloguj się aby pobrać cafe_id")
    parser.add_argument("--auto",     metavar="N",     type=int, default=0,
                        help="Złóż N losowych rezerwacji automatycznie")
    parser.add_argument("--pending",  nargs=2,         metavar=("EMAIL", "HASLO"),
                        help="Wyświetl oczekujące rezerwacje (jako właściciel)")
    parser.add_argument("--url",      default=BASE_URL,
                        help=f"Adres backendu (domyślnie: {BASE_URL})")

    args = parser.parse_args()

    global BASE_URL
    BASE_URL = args.url

    # ── Pokaż oczekujące (tryb właściciela)
    if args.pending:
        list_pending(args.pending[0], args.pending[1])
        return

    # ── Ustal cafe_id
    cafe_id = args.cafe_id

    if not cafe_id and args.login:
        cafe_id = get_cafe_id_from_login(args.login[0], args.login[1])

    if not cafe_id:
        print("Podaj --cafe-id <UUID> lub --login <email> <haslo>")
        print("ID kawiarni znajdziesz w Dashboardzie w sekcji 'Kawiarnia → Identyfikator'.\n")
        # tryb pytania
        cafe_id = input("ID kawiarni: ").strip()
        if not cafe_id:
            parser.print_help()
            sys.exit(1)

    # ── Uruchom symulację
    if args.auto > 0:
        run_auto(cafe_id, args.auto)
    else:
        run_interactive(cafe_id)


if __name__ == "__main__":
    main()