"""Indexes for analytics impact queries.

Revision ID: 0013
Revises: 0012
"""
from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_orders_cafe_created", "orders", ["cafe_id", "created_at"])
    op.create_index("ix_reservations_cafe_created", "reservations", ["cafe_id", "created_at"])
    op.create_index("ix_loyalty_tx_cafe_created", "loyalty_transactions", ["cafe_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_loyalty_tx_cafe_created", table_name="loyalty_transactions")
    op.drop_index("ix_reservations_cafe_created", table_name="reservations")
    op.drop_index("ix_orders_cafe_created", table_name="orders")