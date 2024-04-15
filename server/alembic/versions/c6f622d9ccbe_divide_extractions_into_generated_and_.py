"""divide extractions into generated and digitization

Revision ID: c6f622d9ccbe
Revises: b5d393015c3a
Create Date: 2024-04-10 16:58:12.126534

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = "c6f622d9ccbe"
down_revision = "b5d393015c3a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "generated_extractions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_ids", sa.ARRAY(sa.Integer()), nullable=True),
        sa.Column("selected_pages", sa.Integer(), nullable=True),
        sa.Column("target_pages", sa.Integer(), nullable=True),
        sa.Column("include_categories", sa.ARRAY(sa.Integer()), nullable=True),
        sa.Column("target_pages_threshold", sa.Float(), nullable=True),
        sa.Column("whole_categories_threshold", sa.Float(), nullable=True),
        sa.Column("generated_by", sa.String(), nullable=True),
        sa.Column(
            "generated_at",
            sa.TIMESTAMP(),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "digitization_extractions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_ids", sa.ARRAY(sa.Integer()), nullable=True),
        sa.Column("extracted_pages", sa.Integer(), nullable=True),
        sa.Column("intention_id", sa.Integer(), nullable=True),
        sa.Column("extractor", sa.String(), nullable=True),
        sa.Column(
            "extracted_at",
            sa.TIMESTAMP(),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["intention_id"],
            ["categories_quotas.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.execute(
        """
        INSERT INTO generated_extractions
        (id, document_ids, selected_pages, target_pages,
        include_categories, target_pages_threshold, whole_categories_threshold,
        generated_by, generated_at)
        SELECT id, document_ids, extracted_pages AS selected_pages,
        target_pages, ARRAY[]::INTEGER[], 0.05, 0.05,
        extractor AS generated_by, extracted_at AS generated_at
        FROM extractions
    """
    )

    op.drop_constraint(
        "documents_extraction_id_fkey", "documents", type_="foreignkey"
    )

    next_seq_id = (
        op.get_bind()
        .execute(text("SELECT last_value FROM generated_extractions_id_seq"))
        .fetchone()[0]
        + 1
    )

    op.drop_table("extractions")

    op.create_foreign_key(
        "documents_extraction_id_fkey",
        "documents",
        "digitization_extractions",
        ["extraction_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.execute(
        f"""
        ALTER SEQUENCE generated_extractions_id_seq
        RESTART WITH {next_seq_id}
    """
    )


def downgrade() -> None:
    op.drop_constraint(
        "documents_extraction_id_fkey", "documents", type_="foreignkey"
    )

    op.drop_table("digitization_extractions")

    op.create_table(
        "extractions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("extractor", sa.String(), nullable=True),
        sa.Column(
            "extracted_at",
            sa.TIMESTAMP(),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "marked", sa.Boolean(), server_default="false", nullable=True
        ),
        sa.Column("target_pages", sa.Integer(), nullable=True),
        sa.Column("extracted_pages", sa.Integer(), nullable=True),
        sa.Column("document_ids", sa.ARRAY(sa.Integer()), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.execute(
        """
        INSERT INTO extractions
        (id, document_ids, extractor, extracted_at,
        target_pages, extracted_pages)
        SELECT id, document_ids, generated_by AS extractor,
        generated_at AS extracted_at, target_pages,
        selected_pages AS extracted_pages
        FROM generated_extractions
    """
    )

    next_seq_id = (
        op.get_bind()
        .execute(text("SELECT last_value FROM generated_extractions_id_seq"))
        .fetchone()[0]
        + 1
    )

    op.drop_table("generated_extractions")

    op.create_foreign_key(
        "documents_extraction_id_fkey",
        "documents",
        "extractions",
        ["extraction_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.execute(
        f"""
        ALTER SEQUENCE extractions_id_seq
        RESTART WITH {next_seq_id}
    """
    )
