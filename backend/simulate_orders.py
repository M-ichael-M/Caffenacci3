#!/usr/bin/env python3
"""
simulate_orders.py
───────────────────
Symuluje zamówienia składane przez klientów przez publiczny endpoint.
Menu nie ma jeszcze publicznego odczytu, więc symulator generuje
pozycje "niestandardowe" (bez menu_item_id) — backend i tak je przyjmie.

Użycie:
    python simulate_orders.py --cafe-id <UUID> --auto 5
    python simulate_orders.py --login jan@kawiarnia.pl MojeHaslo1 --auto 5
"""

import argparse
import random
import sys
from datetime import date, timedelta

try:
    import requests
except ImportError:
    print("Zainstaluj requests: pip install requests")
    sys.exit(1)

NICKS = [
    "Kasia_W", "Piotrek99", "AnnaK", "TomekZ", "Gosia.M",
    "MarekK", "Ala_Lewandowska", "JakubD", "Monika_S", "Michal_W",
]

PRODUCTS = [
    ("Cappuccino", 14.0), ("Espresso", 9.0), ("Flat White", 15.0),
    ("Latte", 15.0), ("Herbata", 10.0), ("Sernik", 18.0),
    ("Croissant", 12.0), ("Kanapka z hummusem", 22.0), ("Lemoniada", 13.0),
]

TIMES = ["08:30", "09:00", "10:00", "11:30", "12:00", "13:00",
         "14:30", "15:00", "16:00", "17:30"]


def get_cafe_id_from_login(base_url: str, email: str, password: str) -> str:
    print(f"\n🔑 Logowanie jako {email}…")
    resp = requests.post(f"{base_url}/auth/login", json={"email": email, "password": password})
    if resp.status_code != 200:
        print(f"❌ Błąd logowania: {resp.json().get('detail', resp.text)}")
        sys.exit(1)
    data = resp.json()
    print(f"✅ Zalogowano. Kawiarnia: {data['cafe_name']} (ID: {data['cafe_id']})")
    return data["cafe_id"]


def random_items():
    n = random.randint(1, 4)
    chosen = random.sample(PRODUCTS, n)
    return [
        {"menu_item_id": None, "name": name, "price": price, "quantity": random.randint(1, 3)}
        for name, price in chosen
    ]


def make_order(base_url: str, cafe_id: str, data: dict) -> dict:
    resp = requests.post(f"{base_url}/orders/public/{cafe_id}", json=data)
    return {
        "status_code": resp.status_code,
        "body": resp.json() if resp.headers.get("content-type", "").startswith("application/json") else resp.text,
    }


def print_result(result: dict, data: dict):
    sc, body = result["status_code"], result["body"]
    if sc == 201:
        print(f"  ✅ OK id={body['id'][:8]}… {data['date']} {data['start_time']} "
              f"{data['client_nick']} — {body['total_value']} zł ({len(data['items'])} poz.)")
    else:
        detail = body.get("detail") if isinstance(body, dict) else body
        print(f"  ❌ BŁĄD {sc} {detail}")


def run_auto(base_url: str, cafe_id: str, count: int):
    print(f"\n🤖 Tworzenie {count} zamówień...\n")
    success = fail = 0
    for _ in range(count):
        data = {
            "client_nick": random.choice(NICKS),
            "client_id": None,
            "date": (date.today() + timedelta(days=random.randint(0, 3))).isoformat(),
            "start_time": random.choice(TIMES),
            "items": random_items(),
        }
        result = make_order(base_url, cafe_id, data)
        print_result(result, data)
        success += result["status_code"] == 201
        fail += result["status_code"] != 201
    print(f"\n📊 Wynik: {success} OK, {fail} błędów")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cafe-id")
    parser.add_argument("--login", nargs=2)
    parser.add_argument("--auto", type=int, default=5)
    parser.add_argument("--url", default="http://localhost:8000")
    args = parser.parse_args()

    base_url = args.url
    cafe_id = args.cafe_id
    if not cafe_id and args.login:
        cafe_id = get_cafe_id_from_login(base_url, args.login[0], args.login[1])
    if not cafe_id:
        cafe_id = input("Cafe ID: ").strip()
        if not cafe_id:
            print("Brak ID")
            sys.exit(1)

    run_auto(base_url, cafe_id, args.auto)


if __name__ == "__main__":
    main()