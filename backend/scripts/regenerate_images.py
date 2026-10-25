"""
  python scripts\regenerate_images.py            # dry-run (nic nie zmienia)
  python scripts\regenerate_images.py --apply    # kopia bazy + konwersja
Idempotentny: pomija wiersze już przekonwertowane. Stare pliki są PRZENOSZONE do
uploads/_legacy/<katalog>/ (nie kasowane) — usuń je ręcznie po weryfikacji.
"""
from __future__ import annotations
import argparse, os, shutil, sqlite3, sys
from collections import Counter
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from PIL import Image
from app.core.database import SessionLocal, engine
from app.core.images import GALLERY_TIERS, LOGO_TIERS, is_variant_base, save_image_variants
from app.models.cafe_profile import CafeProfile
from app.models.gallery import CafeGalleryImage
from app.models.news import NewsPost
from app.routers.cafe_profile import GALLERY_UPLOAD_DIR, UPLOAD_DIR as LOGO_DIR
from app.routers.news import UPLOAD_DIR as NEWS_DIR

LEGACY_DIR = os.path.join(os.path.dirname(LOGO_DIR), "_legacy")

# (etykieta, model, kolumna ścieżki, kolumny wymiarów | None, katalog, kafelki, zachowaj alfę)
SPECS = [
    ("galeria", CafeGalleryImage, "image_path", ("width", "height"),             GALLERY_UPLOAD_DIR, GALLERY_TIERS, False),
    ("news",    NewsPost,         "image_path", ("image_width", "image_height"), NEWS_DIR,           GALLERY_TIERS, False),
    ("logo",    CafeProfile,      "logo_path",  None,                            LOGO_DIR,           LOGO_TIERS,    True),
]


def backup_db() -> str:
    if engine.url.get_backend_name() != "sqlite":
        sys.exit("Kopia automatyczna tylko dla SQLite — zrób ją ręcznie i uruchom ponownie.")
    src_file = engine.url.database
    dst_file = f"{src_file}.bak-{datetime.now():%Y%m%d-%H%M%S}"
    src, dst = sqlite3.connect(src_file), sqlite3.connect(dst_file)
    with dst:
        src.backup(dst)
    src.close(); dst.close()
    return dst_file


def largest_variant_dims(directory, base, tiers):
    for t in sorted(tiers, reverse=True):
        p = os.path.join(directory, f"{base}_{t}.webp")
        if os.path.isfile(p):
            with Image.open(p) as im:
                return im.size
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    apply = ap.parse_args().apply

    print("TRYB:", "APPLY" if apply else "DRY-RUN (dodaj --apply, żeby zapisać)")
    if apply:
        print("Kopia bazy:", backup_db())

    db, stats, moves = SessionLocal(), Counter(), []
    for label, model, path_attr, dim_attrs, directory, tiers, alpha in SPECS:
        print(f"\n== {label} ==")
        for row in db.query(model).filter(getattr(model, path_attr).isnot(None)).all():
            old = getattr(row, path_attr)

            if is_variant_base(old):                       # już nowy format
                if dim_attrs and getattr(row, dim_attrs[0]) is None:
                    dims = largest_variant_dims(directory, old, tiers)
                    if dims:
                        print(f"  [WYMIARY] {old}: {dims[0]}x{dims[1]}")
                        if apply:
                            setattr(row, dim_attrs[0], dims[0]); setattr(row, dim_attrs[1], dims[1])
                        stats["dims"] += 1
                else:
                    stats["skip"] += 1
                continue

            src = os.path.join(directory, old)
            if not os.path.isfile(src):
                print(f"  [BRAK PLIKU] {old}"); stats["missing"] += 1; continue

            base = os.path.splitext(old)[0]
            if not apply:
                with Image.open(src) as im:
                    print(f"  [DRY] {old} {im.size[0]}x{im.size[1]} -> {base}_*.webp")
                stats["would_convert"] += 1
                continue
            try:
                with open(src, "rb") as f:
                    saved = save_image_variants(f.read(), base, directory, tiers, keep_alpha=alpha)
            except Exception as e:
                print(f"  [BŁĄD] {old}: {e}"); stats["error"] += 1; continue

            setattr(row, path_attr, base)
            if dim_attrs:
                setattr(row, dim_attrs[0], saved.width); setattr(row, dim_attrs[1], saved.height)
            moves.append((directory, old))
            print(f"  [OK ] {old} -> kafelki {saved.variants}")
            stats["converted"] += 1

    if apply:
        db.commit()
        for directory, old in moves:
            dest = os.path.join(LEGACY_DIR, os.path.basename(directory))
            os.makedirs(dest, exist_ok=True)
            shutil.move(os.path.join(directory, old), os.path.join(dest, old))
        print("\nZrestartuj serwer (cache stron SEO jest w pamięci).")
    db.close()
    print("\nPodsumowanie:", dict(stats))


if __name__ == "__main__":
    main()