"""Language settings and translation packages.

Revision ID: 0003
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cafe_language_settings",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("cafe_id", sa.String(length=36), nullable=False),
        sa.Column("primary_language", sa.String(length=8), nullable=False),
        sa.Column("secondary_language", sa.String(length=8), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("time_zone", sa.String(length=64), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["cafe_id"], ["cafes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_cafe_language_settings_cafe_id"), "cafe_language_settings", ["cafe_id"], unique=True)

    op.create_table(
        "translation_packages",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("cafe_id", sa.String(length=36), nullable=False),
        sa.Column("source_language", sa.String(length=8), nullable=False),
        sa.Column("target_language", sa.String(length=8), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("token", sa.BigInteger(), nullable=False),
        sa.Column("source_hash", sa.String(length=64), nullable=False),
        sa.Column("texts", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["cafe_id"], ["cafes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cafe_id", "target_language", "version", name="uq_translation_package_version"),
    )
    op.create_index(op.f("ix_translation_packages_cafe_id"), "translation_packages", ["cafe_id"], unique=False)
    op.create_index(op.f("ix_translation_packages_token"), "translation_packages", ["token"], unique=True)

    op.create_table(
        "cafe_translations",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("cafe_id", sa.String(length=36), nullable=False),
        sa.Column("source_language", sa.String(length=8), nullable=False),
        sa.Column("target_language", sa.String(length=8), nullable=False),
        sa.Column("package_id", sa.String(length=36), nullable=True),
        sa.Column("package_version", sa.Integer(), nullable=False),
        sa.Column("source_hash", sa.String(length=64), nullable=False),
        sa.Column("entries", sa.Text(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["cafe_id"], ["cafes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["package_id"], ["translation_packages.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cafe_id", "target_language", name="uq_cafe_translation_language"),
    )
    op.create_index(op.f("ix_cafe_translations_cafe_id"), "cafe_translations", ["cafe_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_cafe_translations_cafe_id"), table_name="cafe_translations")
    op.drop_table("cafe_translations")
    op.drop_index(op.f("ix_translation_packages_token"), table_name="translation_packages")
    op.drop_index(op.f("ix_translation_packages_cafe_id"), table_name="translation_packages")
    op.drop_table("translation_packages")
    op.drop_index(op.f("ix_cafe_language_settings_cafe_id"), table_name="cafe_language_settings")
    op.drop_table("cafe_language_settings")