"""Revision 2024.10-02

Revision ID: bff6e9bf48c1
Revises: 73577bae05f1
Create Date: 2024-10-18 19:05:49.179771

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "bff6e9bf48c1"
down_revision = "73577bae05f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "extraction_documents",
        sa.Column("extraction_id", sa.int(), nullable=False),
        sa.Column("document_id", sa.int(), nullable=False),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["documents.id"],
        ),
        sa.ForeignKeyConstraint(
            ["extraction_id"],
            ["generated_extractions.id"],
        ),
        sa.PrimaryKeyConstraint("extraction_id", "document_id"),
    )
    op.create_index(
        op.f("ix_extraction_documents_document_id"),
        "extraction_documents",
        ["document_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_extraction_documents_extraction_id"),
        "extraction_documents",
        ["extraction_id"],
        unique=False,
    )

    op.execute(
        """
        INSERT INTO extraction_documents (extraction_id, document_id)
        SELECT
            extraction_id,
            document_id
        FROM (
            SELECT
                ge.id AS extraction_id,
                (json_array_elements_text(ge.document_ids))::int
                    AS document_id
            FROM
                generated_extractions ge
        ) AS extracted_docs
        JOIN
            documents d ON extracted_docs.document_id = d.id;
        """
    )

    op.drop_column("generated_extractions", "document_ids")


def downgrade() -> None:
    op.add_column(
        "generated_extractions",
        sa.Column(
            "document_ids",
            postgresql.JSON(astext_type=sa.Text()),
            autoincrement=False,
            nullable=True,
        ),
    )

    op.execute(
        """
        UPDATE generated_extractions
        SET document_ids = subquery.document_ids
        FROM (
            SELECT
                extraction_id,
                json_agg(document_id ORDER BY document_id) AS document_ids
            FROM extraction_documents
            GROUP BY extraction_id
        ) AS subquery
        WHERE generated_extractions.id = subquery.extraction_id;
        """
    )

    op.drop_index(
        op.f("ix_extraction_documents_extraction_id"),
        table_name="extraction_documents",
    )
    op.drop_index(
        op.f("ix_extraction_documents_document_id"),
        table_name="extraction_documents",
    )
    op.drop_table("extraction_documents")
