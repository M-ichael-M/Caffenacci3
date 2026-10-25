import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect, text
from app.core.database import engine
from app.models.gallery import CafeGalleryImage
from app.models.news import NewsPost

TARGETS = [
    (CafeGalleryImage.__tablename__, "width"),
    (CafeGalleryImage.__tablename__, "height"),
    (NewsPost.__tablename__, "image_width"),
    (NewsPost.__tablename__, "image_height"),
]

def main():
    insp = inspect(engine)
    with engine.begin() as conn:
        for table, col in TARGETS:
            if col in {c["name"] for c in insp.get_columns(table)}:
                print(f"= {table}.{col} już istnieje")
                continue
            conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN "{col}" INTEGER'))
            print(f"+ {table}.{col}")

        # Index for existing DB (create_all only creates indexes on brand-new tables)
        conn.execute(text(
            'CREATE INDEX IF NOT EXISTS ix_reviews_cafe_created ON reviews (cafe_id, created_at)'
        ))
        print("+ ix_reviews_cafe_created")

if __name__ == "__main__":
    main()