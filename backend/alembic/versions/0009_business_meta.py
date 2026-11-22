"""Dane SEO kawiarni: Google Maps (CID/Place ID), przedział cen, kuchnia, płatności.

Revision ID: 0009
Revises: 0008
"""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cafe_profiles", sa.Column("google_place_id", sa.String(length=255), nullable=True))
    op.add_column("cafe_profiles", sa.Column("google_maps_cid", sa.String(length=20), nullable=True))
    op.add_column("cafe_profiles", sa.Column("price_range", sa.String(length=4), nullable=True))
    op.add_column("cafe_profiles", sa.Column("serves_cuisine", sa.Text(), nullable=True))
    op.add_column("cafe_profiles", sa.Column("payment_methods", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("cafe_profiles") as batch:
        batch.drop_column("payment_methods")
        batch.drop_column("serves_cuisine")
        batch.drop_column("price_range")
        batch.drop_column("google_maps_cid")
        batch.drop_column("google_place_id")