"""add extraction statistics

Revision ID: 59b5c2b5e72a
Revises: edab63d983e3
Create Date: 2024-02-19 16:30:09.668694

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "59b5c2b5e72a"
down_revision = "edab63d983e3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "extractions",
        sa.Column(
            "marked", sa.bool(), nullable=True, server_default=sa.false()
        ),
    )
    op.add_column(
        "extractions", sa.Column("target_pages", sa.int(), nullable=True)
    )
    op.add_column(
        "extractions",
        sa.Column("extracted_pages", sa.int(), nullable=True),
    )
    op.add_column(
        "extractions",
        sa.Column("document_ids", sa.ARRAY(sa.int()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("extractions", "document_ids")
    op.drop_column("extractions", "extracted_pages")
    op.drop_column("extractions", "target_pages")
    op.drop_column("extractions", "marked")
