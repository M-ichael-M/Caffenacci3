"""Loyalty points rule: points_per_amount (P) per points_amount_unit (N) of cafe currency.

Revision ID: 0006
Revises: 0005
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # server_default = backfill istniejących wierszy: 30 pkt za 1 jednostkę waluty,
    # czyli dzisiejszy kurs (3 pkt za 0,10).
    op.add_column("loyalty_settings", sa.Column(
        "points_per_amount", sa.Integer(), nullable=False, server_default="30"))
    op.add_column("loyalty_settings", sa.Column(
        "points_amount_unit", sa.Integer(), nullable=False, server_default="1"))


def downgrade() -> None:
    with op.batch_alter_table("loyalty_settings") as batch:
        batch.drop_column("points_amount_unit")
        batch.drop_column("points_per_amount")