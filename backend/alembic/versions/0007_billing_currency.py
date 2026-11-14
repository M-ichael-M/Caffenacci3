"""Billing currency: cafes.billing_currency (preference), subscriptions.billing_currency + price_minor (snapshot).

Revision ID: 0007
Revises: 0006
"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cafes", sa.Column("billing_currency", sa.String(length=3), nullable=True))
    op.add_column("subscriptions", sa.Column(
        "billing_currency", sa.String(length=3), nullable=False, server_default="PLN"))
    op.add_column("subscriptions", sa.Column("price_minor", sa.Integer(), nullable=True))
    # Istniejące (symulowane) płatne subskrypcje: 20 PLN — blokuje to walutę rozliczeń w PLN.
    op.execute("UPDATE subscriptions SET price_minor = 2000 WHERE kind = 'subscription'")


def downgrade() -> None:
    with op.batch_alter_table("subscriptions") as batch:
        batch.drop_column("price_minor")
        batch.drop_column("billing_currency")
    with op.batch_alter_table("cafes") as batch:
        batch.drop_column("billing_currency")