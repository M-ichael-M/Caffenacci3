"""PostgreSQL search extensions and trigram indexes.

Revision ID: 0002
Revises: 0001
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cafes_name_trgm ON cafes USING gin (cafe_name gin_trgm_ops)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cafes_city_trgm ON cafes USING gin (city gin_trgm_ops)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cafes_street_trgm ON cafes USING gin (street gin_trgm_ops)")


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute("DROP INDEX IF EXISTS ix_cafes_street_trgm")
    op.execute("DROP INDEX IF EXISTS ix_cafes_city_trgm")
    op.execute("DROP INDEX IF EXISTS ix_cafes_name_trgm")
    # Extensions are shared at database level; leave them installed.
