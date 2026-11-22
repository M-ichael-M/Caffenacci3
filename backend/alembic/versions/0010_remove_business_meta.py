"""Remove optional Google and search engine profile details.

Revision ID: 0010
Revises: 0009
"""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("cafe_profiles") as batch:
        batch.drop_column("payment_methods")
        batch.drop_column("serves_cuisine")
        batch.drop_column("price_range")
        batch.drop_column("google_maps_cid")
        batch.drop_column("google_place_id")


def downgrade() -> None:
    with op.batch_alter_table("cafe_profiles") as batch:
        batch.add_column(sa.Column("google_place_id", sa.String(length=255), nullable=True))
        batch.add_column(sa.Column("google_maps_cid", sa.String(length=20), nullable=True))
        batch.add_column(sa.Column("price_range", sa.String(length=4), nullable=True))
        batch.add_column(sa.Column("serves_cuisine", sa.Text(), nullable=True))
        batch.add_column(sa.Column("payment_methods", sa.Text(), nullable=True))
