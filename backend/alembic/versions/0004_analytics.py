"""Privacy-first analytics tables.

Revision ID: 0004
Revises: 0003
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "analytics_daily",
        sa.Column("cafe_id", sa.String(length=36), nullable=False),
        sa.Column("day", sa.String(length=10), nullable=False),
        sa.Column("metric", sa.String(length=40), nullable=False),
        sa.Column("dim", sa.String(length=40), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["cafe_id"], ["cafes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("cafe_id", "day", "metric", "dim"),
    )
    op.create_index("ix_analytics_daily_cafe_day", "analytics_daily", ["cafe_id", "day"])

    op.create_table(
        "analytics_visitor_day",
        sa.Column("cafe_id", sa.String(length=36), nullable=False),
        sa.Column("day", sa.String(length=10), nullable=False),
        sa.Column("visitor_hash", sa.String(length=32), nullable=False),
        sa.Column("last_seen", sa.DateTime(), nullable=False),
        sa.Column("pageviews", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["cafe_id"], ["cafes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("cafe_id", "day", "visitor_hash"),
    )
    op.create_index("ix_analytics_visitor_day_day", "analytics_visitor_day", ["day"])


def downgrade() -> None:
    op.drop_index("ix_analytics_visitor_day_day", table_name="analytics_visitor_day")
    op.drop_table("analytics_visitor_day")
    op.drop_index("ix_analytics_daily_cafe_day", table_name="analytics_daily")
    op.drop_table("analytics_daily")
