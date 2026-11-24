"""Promo codes in DB (usage limit, expiry, redemption log) + seed CAFE7 / CAFE30.

Revision ID: 0011
Revises: 0010
"""
import uuid
from datetime import datetime

from alembic import op
import sqlalchemy as sa

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "promo_codes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("days", sa.Integer(), nullable=False),
        sa.Column("max_uses", sa.Integer(), nullable=True),
        sa.Column("uses_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("days > 0", name="ck_promo_days_positive"),
        sa.CheckConstraint("max_uses IS NULL OR max_uses > 0", name="ck_promo_max_uses_positive"),
    )
    op.create_index(op.f("ix_promo_codes_code"), "promo_codes", ["code"], unique=True)

    op.create_table(
        "promo_redemptions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("promo_id", sa.String(length=36), nullable=False),
        sa.Column("cafe_id", sa.String(length=36), nullable=False),
        sa.Column("redeemed_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["promo_id"], ["promo_codes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["cafe_id"], ["cafes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cafe_id", "promo_id", name="uq_promo_redemption_cafe_promo"),
    )
    op.create_index(op.f("ix_promo_redemptions_promo_id"), "promo_redemptions", ["promo_id"], unique=False)
    op.create_index(op.f("ix_promo_redemptions_cafe_id"), "promo_redemptions", ["cafe_id"], unique=False)

    promo = sa.table(
        "promo_codes",
        sa.column("id", sa.String), sa.column("code", sa.String), sa.column("days", sa.Integer),
        sa.column("max_uses", sa.Integer), sa.column("uses_count", sa.Integer),
        sa.column("expires_at", sa.DateTime), sa.column("is_active", sa.Boolean),
        sa.column("created_at", sa.DateTime),
    )
    now = datetime.utcnow()
    op.bulk_insert(promo, [
        # max_uses=NULL: każda kawiarnia może użyć kodu raz (pilnuje tego uq_promo_redemption_cafe_promo).
        # Chcesz globalnie jedno użycie? Ustaw max_uses=1.
        {"id": str(uuid.uuid4()), "code": "CAFE7",  "days": 7,  "max_uses": None,
         "uses_count": 0, "expires_at": None, "is_active": True, "created_at": now},
        {"id": str(uuid.uuid4()), "code": "CAFE30", "days": 30, "max_uses": None,
         "uses_count": 0, "expires_at": None, "is_active": True, "created_at": now},
    ])


def downgrade() -> None:
    op.drop_index(op.f("ix_promo_redemptions_cafe_id"), table_name="promo_redemptions")
    op.drop_index(op.f("ix_promo_redemptions_promo_id"), table_name="promo_redemptions")
    op.drop_table("promo_redemptions")
    op.drop_index(op.f("ix_promo_codes_code"), table_name="promo_codes")
    op.drop_table("promo_codes")