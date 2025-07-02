"""add alt ids and extraction priority to documents

Revision ID: 80a0a683bc0f
Revises: 56f17323d714
Create Date: 2024-07-02 16:00:52.447653

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "80a0a683bc0f"
down_revision = "56f17323d714"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add alternative_ids column
    op.add_column(
        "documents",
        sa.Column("alternative_ids", sa.ARRAY(sa.String), nullable=True),
    )

    # Add extraction_priority column with CheckConstraint
    op.add_column(
        "documents",
        sa.Column(
            "extraction_priority",
            sa.int,
            nullable=False,
            server_default=sa.text("3"),
            comment="Priority of extraction (1-5)",
        ),
    )
    op.create_check_constraint(
        "check_extraction_priority",
        "documents",
        sa.and_(
            sa.column("extraction_priority") >= 1,
            sa.column("extraction_priority") <= 5,
        ),
    )


def downgrade() -> None:
    # Drop alternative_ids column
    op.drop_column("documents", "alternative_ids")

    # Drop extraction_priority column and CheckConstraint
    op.drop_constraint("check_extraction_priority", "documents", type_="check")
    op.drop_column("documents", "extraction_priority")
