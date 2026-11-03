"""SQLite -> PostgreSQL (jednorazowe przeniesienie danych).

Użycie (z katalogu backend/, po `alembic upgrade head` na PUSTEJ bazie Postgres):
  python scripts/sqlite_to_postgres.py --sqlite-path caffenacci.db --pg-url postgresql+psycopg://u:p@localhost:5432/caffenacci
  python scripts/sqlite_to_postgres.py --sqlite-path caffenacci.db --pg-url postgresql+psycopg://u:p@localhost:5432/caffenacci --apply

Domyślnie --dry-run: czyta CAŁE źródło, waliduje (długości, enumy, daty, sierotki FK,
kolumny), sprawdza cel (schemat, pustość) i niczego nie zapisuje.
SQLite jest otwierany z PRAGMA query_only=ON, czyli nic w nim nie jest modyfikowane.
Id to teksty UUID, więc nie ma sekwencji do resetowania.
"""
from __future__ import annotations

import argparse
import sys
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BATCH = 500


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--sqlite-path", required=True)
    p.add_argument("--pg-url", required=True)
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="(domyślnie) tylko walidacja")
    mode.add_argument("--apply", action="store_true", help="wykonaj kopiowanie")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    pg_url = args.pg_url
    for prefix in ("postgres://", "postgresql://"):
        if pg_url.startswith(prefix):
            pg_url = "postgresql+psycopg://" + pg_url[len(prefix):]
    from sqlalchemy import Boolean, Date, DateTime, Enum as SAEnum
    from sqlalchemy import create_engine, event, func, inspect, literal, select

    from app.core.database import Base
    import app.models  # noqa: F401

    tables = Base.metadata.sorted_tables           # kolejność zgodna z FK
    sqlite_path = Path(args.sqlite_path).resolve()
    if not sqlite_path.is_file():
        print(f"BŁĄD: nie ma pliku {sqlite_path}")
        return 1

    src = create_engine(f"sqlite:///{sqlite_path.as_posix()}")

    @event.listens_for(src, "connect")
    def _ro(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA query_only=ON")

    dst = create_engine(pg_url, pool_pre_ping=True)
    errors: list[str] = []

    # ── Cel: schemat po alembic, pusty ──────────────────────────────────
    d_insp = inspect(dst)
    if not d_insp.has_table("alembic_version"):
        print("BŁĄD: cel nie ma tabeli alembic_version. Uruchom najpierw `alembic upgrade head`.")
        return 1
    absent = [t.name for t in tables if not d_insp.has_table(t.name)]
    if absent:
        print(f"BŁĄD: w celu brakuje tabel: {', '.join(absent)}. Uruchom `alembic upgrade head`.")
        return 1
    with dst.connect() as dc:
        ver = dc.exec_driver_sql("SELECT version_num FROM alembic_version").scalar()
        nonempty = [t.name for t in tables
                    if dc.execute(select(literal(1)).select_from(t).limit(1)).first()]
    print(f"Cel: {dst.url.render_as_string(hide_password=True)} (alembic: {ver})")
    if nonempty:
        print(f"BŁĄD: tabele docelowe NIE są puste: {', '.join(nonempty)}. Przerywam (nic nie skasowano).")
        return 1

    # ── Źródło: kolumny, które faktycznie istnieją ───────────────────────
    s_insp = inspect(src)
    cols_of: dict[str, list] = {}
    for t in tables:
        if not s_insp.has_table(t.name):
            print(f"UWAGA: tabeli {t.name} nie ma w SQLite, traktuję jako pustą")
            cols_of[t.name] = []
            continue
        present = {c["name"] for c in s_insp.get_columns(t.name)}
        cols_of[t.name] = [c for c in t.c if c.name in present]
        for c in t.c:
            if c.name not in present and not c.nullable and c.default is None and c.server_default is None:
                errors.append(f"{t.name}.{c.name}: brak kolumny w SQLite, a jest NOT NULL bez domyślnej")

    def fk_pairs(t):
        for fkc in t.foreign_key_constraints:
            yield next(iter(fkc.columns)), fkc.elements[0].column

    def orphan_ids(conn, t, present: set[str]) -> set[str]:
        ids: set[str] = set()
        for col, ref in fk_pairs(t):
            if col.name not in present:
                continue
            parent_exists = select(literal(1)).select_from(ref.table).where(ref == col).exists()
            q = select(t.c.id).where(col.isnot(None), ~parent_exists)
            ids |= {r[0] for r in conn.execute(q)}
        return ids

    def iter_rows(conn, t):
        res = conn.execution_options(stream_results=True).execute(select(*cols_of[t.name]))
        for part in res.mappings().partitions(BATCH):
            batch = []
            for item in part:
                row = dict(item)
                for col in cols_of[t.name]:
                    value = row.get(col.name)
                    if value is None:
                        continue
                    if isinstance(col.type, Boolean):
                        row[col.name] = bool(value)
                    elif isinstance(col.type, SAEnum) and isinstance(value, str):
                        enum_cls = col.type.enum_class
                        row[col.name] = enum_cls(value) if enum_cls else value
                    elif isinstance(col.type, DateTime) and isinstance(value, str):
                        row[col.name] = datetime.fromisoformat(value)
                    elif isinstance(col.type, Date) and isinstance(value, str):
                        row[col.name] = date.fromisoformat(value)
                batch.append(row)
            yield batch

    def too_long(t, row) -> list[str]:
        out = []
        for c in t.c:
            length, v = getattr(c.type, "length", None), row.get(c.name)
            if length and isinstance(v, str) and not isinstance(c.type, SAEnum) and len(v) > length:
                out.append(f"{t.name}.{c.name} ({len(v)}>{length}) id={row.get('id')}")
        return out

    skipped: dict[str, set[str]] = {t.name: set() for t in tables}
    src_count: dict[str, int] = {}
    orphans: dict[str, set[str]] = {}

    def is_orphan(t, row) -> bool:
        if row["id"] in orphans.get(t.name, ()):
            return True
        for col, ref in fk_pairs(t):
            v = row.get(col.name)
            if v is not None and v in skipped[ref.table.name]:
                return True
        return False

    # ── Faza 1: pełny odczyt + walidacja (bez zapisu) ────────────────────
    print("\n== Walidacja źródła ==")
    with src.connect() as sc:
        for t in tables:
            if not cols_of[t.name]:
                src_count[t.name] = 0
                continue
            present = {c.name for c in cols_of[t.name]}
            n, long_rows = 0, []
            try:
                orphans[t.name] = orphan_ids(sc, t, present)
                for batch in iter_rows(sc, t):
                    for row in batch:
                        n += 1
                        long_rows += too_long(t, row)
                        if is_orphan(t, row):
                            skipped[t.name].add(row["id"])
            except Exception as e:  # np. nieznana wartość enum, zła data
                errors.append(f"{t.name}: błąd odczytu/konwersji: {type(e).__name__}: {e}")
                continue
            src_count[t.name] = n
            flag = ""
            if skipped[t.name]:
                flag = f"  SIEROTY={len(skipped[t.name])}"
                errors.append(f"{t.name}: {len(skipped[t.name])} sierot FK")
            if long_rows:
                errors += [f"za długie: {x}" for x in long_rows[:5]]
            print(f"  {t.name:<28} wierszy={n:>6}{flag}")

    if errors:
        print("\nBŁĘDY:")
        for e in errors:
            print("  -", e)
        print("\nNic nie zapisano.")
        return 1
    if not args.apply:
        print("\nDRY-RUN OK: źródło wygląda poprawnie, cel jest pusty. Uruchom ponownie z --apply.")
        return 0

    # ── Faza 2: kopiowanie, jedna transakcja na tabelę ───────────────────
    print("\n== Kopiowanie ==")
    with src.connect() as sc:
        for t in tables:
            if not cols_of[t.name]:
                continue
            copied = 0
            with dst.begin() as dc:
                for batch in iter_rows(sc, t):
                    batch = [r for r in batch if not is_orphan(t, r)]
                    if batch:
                        dc.execute(t.insert(), batch)
                        copied += len(batch)
            print(f"  {t.name:<28} skopiowano={copied}")

    # ── Raport końcowy ───────────────────────────────────────────────────
    print("\n== Raport liczności ==")
    bad = False
    with dst.connect() as dc:
        for t in tables:
            expected = src_count[t.name] - len(skipped[t.name])
            got = dc.execute(select(func.count()).select_from(t)).scalar_one()
            pg_orph = len(orphan_ids(dc, t, {c.name for c in t.c}))
            ok = got == expected and pg_orph == 0
            bad |= not ok
            print(f"  {t.name:<28} źródło={src_count[t.name]:>6} pominięto={len(skipped[t.name]):>4} "
                  f"cel={got:>6} sieroty_FK={pg_orph}  {'OK' if ok else 'RÓŻNICA'}")
    print("\nWYNIK:", "RÓŻNICE: sprawdź powyżej" if bad else "wszystko OK")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
