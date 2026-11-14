"""cafe_language_settings.region_confirmed — czy właściciel potwierdził strefę i walutę.

Revision ID: 0008
Revises: 0007
"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # server_default true = istniejące wiersze uznajemy za potwierdzone (nie nagabujemy).
    op.add_column("cafe_language_settings", sa.Column(
        "region_confirmed", sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade() -> None:
    with op.batch_alter_table("cafe_language_settings") as batch:
        batch.drop_column("region_confirmed")