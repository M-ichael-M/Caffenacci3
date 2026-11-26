"""Indexes for client history lists.

Revision ID: 0012
Revises: 0011
"""
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_orders_client_created", "orders", ["client_id", "created_at"])
    op.create_index("ix_reservations_client_date", "reservations", ["client_id", "date", "start_time"])
    op.create_index("ix_reviews_client_created", "reviews", ["client_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_reviews_client_created", table_name="reviews")
    op.drop_index("ix_reservations_client_date", table_name="reservations")
    op.drop_index("ix_orders_client_created", table_name="orders")