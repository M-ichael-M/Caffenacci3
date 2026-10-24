"""Jednorazowa migracja slugów na format nazwa-miasto.

  python scripts\\migrate_slugs.py                    # dry-run (domyślnie)
  python scripts\\migrate_slugs.py --apply            # kopia bazy + zapis
  python scripts\\migrate_slugs.py --db kopia.db ...  # inna baza niż w aplikacji

Idempotentny: ponowne uruchomienie nic nie zmienia.
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.core.slugs import apply_slug_change  # noqa: E402
from app.models.cafe import Cafe  # noqa: E402
from app.models.slug_history import CafeSlugHistory  # noqa: E402


def default_db_path() -> Path:
    from app.core.database import engine as app_engine

    db = app_engine.url.database
    if not db:
        sys.exit("Nie da się ustalić ścieżki bazy — podaj --db.")
    p = Path(db)
    return p if p.is_absolute() else Path.cwd() / p


def backup_db(path: Path) -> Path:
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    dst = path.with_name(f"{path.stem}.backup-{ts}{path.suffix}")
    src_conn = sqlite3.connect(str(path))
    dst_conn = sqlite3.connect(str(dst))
    try:
        with dst_conn:
            src_conn.backup(dst_conn)  # spójna kopia także przy włączonym WAL
    finally:
        dst_conn.close()
        src_conn.close()
    return dst


def main() -> None:
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="(domyślny) tylko raport")
    mode.add_argument("--apply", action="store_true", help="zapisz zmiany (po kopii bazy)")
    ap.add_argument("--db", type=Path, help="ścieżka do pliku SQLite")
    args = ap.parse_args()

    db_path = (args.db or default_db_path()).resolve()
    if not db_path.is_file():
        sys.exit(f"Brak pliku bazy: {db_path}")

    print(f"Baza: {db_path}")
    print(f"Tryb: {'APPLY' if args.apply else 'DRY-RUN'}")

    if args.apply:
        print(f"Kopia zapasowa: {backup_db(db_path)}")

    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    # (dry-run też tworzy pustą tabelę historii, jeśli jej brak — jest bezpieczna)
    CafeSlugHistory.__table__.create(bind=engine, checkfirst=True)

    db = sessionmaker(bind=engine)()
    changed = unchanged = 0
    try:
        for cafe in db.query(Cafe).order_by(Cafe.cafe_name, Cafe.id).all():
            old = cafe.slug
            if apply_slug_change(cafe, db):
                db.flush()  # kolejne kawiarnie widzą już przydzielone slugi
                changed += 1
                print(f"[ZMIANA] {cafe.id}  {old or '(brak)'} -> {cafe.slug}")
            else:
                unchanged += 1
                print(f"[OK]     {cafe.id}  {old}")

        if args.apply:
            db.commit()
        else:
            db.rollback()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print(f"\nZmienione: {changed}, bez zmian: {unchanged}.")
    if not args.apply and changed:
        print("To był dry-run — nic nie zapisano. Użyj --apply.")


if __name__ == "__main__":
    main()