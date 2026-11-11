"""Order/loyalty currency snapshot; Float -> Numeric(12,2) for money columns.

Revision ID: 0005
Revises: 0004
"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

MONEY_COLUMNS = (("menu_items", "price"), ("order_items", "price"), ("orders", "total_value"))


def _backfill(table: str) -> None:
    # Waluta z ustawień kawiarni; brak wiersza ustawień = zostaje domyślne PLN.
    op.execute(f"""
        UPDATE {table} SET currency = (
            SELECT s.currency FROM cafe_language_settings s WHERE s.cafe_id = {table}.cafe_id)
        WHERE EXISTS (
            SELECT 1 FROM cafe_language_settings s WHERE s.cafe_id = {table}.cafe_id)
    """)


def upgrade() -> None:
    for table in ("orders", "loyalty_transactions"):
        op.add_column(table, sa.Column("currency", sa.String(length=3), nullable=False, server_default="PLN"))
        _backfill(table)

    for table, col in MONEY_COLUMNS:
        with op.batch_alter_table(table) as batch:
            batch.alter_column(
                col, existing_type=sa.Float(), type_=sa.Numeric(12, 2),
                existing_nullable=False,
                postgresql_using=f"round({col}::numeric, 2)",
            )


def downgrade() -> None:
    for table, col in MONEY_COLUMNS:
        with op.batch_alter_table(table) as batch:
            batch.alter_column(
                col, existing_type=sa.Numeric(12, 2), type_=sa.Float(),
                existing_nullable=False,
                postgresql_using=f"{col}::double precision",
            )
    for table in ("loyalty_transactions", "orders"):
        with op.batch_alter_table(table) as batch:
            batch.drop_column("currency")