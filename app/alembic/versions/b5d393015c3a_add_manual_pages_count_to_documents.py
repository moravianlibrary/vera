"""add manual pages count to documents

Revision ID: b5d393015c3a
Revises: 35b7a708adec
Create Date: 2024-04-02 15:01:35.043466

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "b5d393015c3a"
down_revision = "35b7a708adec"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column("pages_count_manual", sa.int(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("documents", "pages_count_manual")
