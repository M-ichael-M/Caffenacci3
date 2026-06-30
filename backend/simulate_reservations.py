#!/usr/bin/env python3
"""
simulate_reservations.py
────────────────────────
Symuluje rezerwacje składane przez klientów przez publiczny endpoint.
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


# ── Dane testowe ──────────────────────────────────────────────────────────────

NAMES = [
    "Anna Kowalska", "Piotr Nowak", "Maria Wiśniewska", "Tomasz Zieliński",
    "Katarzyna Wójcik", "Marek Kamiński", "Agnieszka Lewandowska", "Jakub Dąbrowski",
    "Monika Szymańska", "Michał Woźniak", "Joanna Kozłowska", "Krzysztof Jankowski",
    "Barbara Mazur", "Łukasz Wojciechowski", "Ewa Kwiatkowska", "Dawid Krawczyk",
]

PHONES = [
    "+48 501 234 567", "+48 602 345 678", "+48 503 456 789",
    "+48 604 567 890", "+48 505 678 901", "+48 606 789 012",
    None, None,
]

COMMENTS = [
    "Urodziny mojej córki 🎂",
    "Spotkanie biznesowe, prosimy o spokojny stolik",
    "Pierwsza rocznica ślubu ❤️",
    "Wegetarianie — czy menu to uwzględnia?",
    "Przyjdziemy z dzieckiem w wózku",
    "Proszę o stolik przy oknie jeśli możliwe",
    "Obchody awansu — będziemy świętować!",
    None, None, None,
]

TIMES = [
    "10:00", "11:00", "12:00", "13:00", "14:00",
    "15:00", "16:00", "17:00", "18:00", "19:00"
]


# ── Logowanie ────────────────────────────────────────────────────────────────

def get_cafe_id_from_login(base_url: str, email: str, password: str) -> str:
    print(f"\n🔑 Logowanie jako {email}…")

    resp = requests.post(
        f"{base_url}/auth/login",
        json={"email": email, "password": password},
    )

    if resp.status_code != 200:
        print(f"❌ Błąd logowania: {resp.json().get('detail', resp.text)}")
        sys.exit(1)

    data = resp.json()
    print(f"✅ Zalogowano. Kawiarnia: {data['cafe_name']} (ID: {data['cafe_id']})")
    return data["cafe_id"]


# ── Rezerwacje ───────────────────────────────────────────────────────────────

def make_reservation(base_url: str, cafe_id: str, data: dict) -> dict:
    resp = requests.post(
        f"{base_url}/reservations/public/{cafe_id}",
        json=data,
        headers={"Content-Type": "application/json"},
    )
    return {
        "status_code": resp.status_code,
        "body": resp.json() if resp.headers.get("content-type", "").startswith("application/json") else resp.text
    }


def random_future_date(days_min=1, days_max=14) -> str:
    delta = random.randint(days_min, days_max)
    return (date.today() + timedelta(days=delta)).isoformat()


def print_result(result: dict, data: dict):
    sc = result["status_code"]
    body = result["body"]

    if sc == 201:
        print(
            f"  ✅ OK id={body['id'][:8]}… "
            f"{data['date']} {data['start_time']} "
            f"{data['guests']} os. {data['guest_name']}"
        )
    else:
        detail = body.get("detail") if isinstance(body, dict) else body
        print(f"  ❌ BŁĄD {sc} {detail}")


# ── AUTO ──────────────────────────────────────────────────────────────────────

def run_auto(base_url: str, cafe_id: str, count: int):
    print(f"\n🤖 Tworzenie {count} rezerwacji...\n")

    success = 0
    fail = 0

    for _ in range(count):
        data = {
            "date": random_future_date(),
            "start_time": random.choice(TIMES),
            "guests": random.randint(1, 6),
            "guest_name": random.choice(NAMES),
            "guest_phone": random.choice(PHONES),
            "guest_email": None,
            "comment": random.choice(COMMENTS),
        }

        result = make_reservation(base_url, cafe_id, data)
        print_result(result, data)

        if result["status_code"] == 201:
            success += 1
        else:
            fail += 1

    print(f"\n📊 Wynik: {success} OK, {fail} błędów")


# ── INTERACTIVE ──────────────────────────────────────────────────────────────

def run_interactive(base_url: str, cafe_id: str):
    print(f"\n📝 Tryb interaktywny ({cafe_id[:8]})")

    def ask(prompt, default=""):
        v = input(f"{prompt} [{default}]: ").strip()
        return v if v else default

    while True:
        print("-" * 40)

        data = {
            "date": ask("Data", (date.today() + timedelta(days=1)).isoformat()),
            "start_time": ask("Godzina", "12:00"),
            "guests": int(ask("Goście", "2")),
            "guest_name": ask("Imię", random.choice(NAMES)),
            "guest_phone": ask("Telefon", "") or None,
            "guest_email": ask("Email", "") or None,
            "comment": ask("Komentarz", "") or None,
        }

        result = make_reservation(base_url, cafe_id, data)
        print_result(result, data)

        again = input("Kolejna? [T/n]: ").lower()
        if again in ("n", "nie", "no"):
            break


# ── LISTA OWNER ──────────────────────────────────────────────────────────────

def list_pending(base_url: str, email: str, password: str):
    resp = requests.post(
        f"{base_url}/auth/login",
        json={"email": email, "password": password},
    )

    if resp.status_code != 200:
        print("❌ Błąd logowania")
        return

    token = resp.json()["access_token"]

    resp2 = requests.get(
        f"{base_url}/reservations?status=pending",
        headers={"Authorization": f"Bearer {token}"},
    )

    if resp2.status_code != 200:
        print(f"❌ Błąd pobierania: {resp2.text}")
        return

    data = resp2.json()["reservations"]

    print(f"\n📋 Pending: {len(data)}\n")

    for r in data:
        print(f"{r['id'][:8]} {r['date']} {r['start_time']} {r['guest_name']}")


# ── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()

    parser.add_argument("--cafe-id")
    parser.add_argument("--login", nargs=2)
    parser.add_argument("--auto", type=int, default=0)
    parser.add_argument("--pending", nargs=2)
    parser.add_argument("--url", default="http://localhost:8000")

    args = parser.parse_args()

    base_url = args.url

    if args.pending:
        list_pending(base_url, args.pending[0], args.pending[1])
        return

    cafe_id = args.cafe_id

    if not cafe_id and args.login:
        cafe_id = get_cafe_id_from_login(base_url, args.login[0], args.login[1])

    if not cafe_id:
        cafe_id = input("Cafe ID: ").strip()
        if not cafe_id:
            print("Brak ID")
            sys.exit(1)

    if args.auto > 0:
        run_auto(base_url, cafe_id, args.auto)
    else:
        run_interactive(base_url, cafe_id)


if __name__ == "__main__":
    main()