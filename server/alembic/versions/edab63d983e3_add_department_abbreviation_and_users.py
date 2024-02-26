"""add department abbreviation and users

Revision ID: edab63d983e3
Revises: 44796b939a65
Create Date: 2024-02-19 16:19:47.841913

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "edab63d983e3"
down_revision = "44796b939a65"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "departments", sa.Column("abbreviation", sa.String(), nullable=True)
    )
    op.add_column(
        "departments", sa.Column("users", sa.ARRAY(sa.String()), nullable=True)
    )
    op.create_unique_constraint(
        "departments_abbreviation_key", "departments", ["abbreviation"]
    )


def downgrade() -> None:
    op.drop_constraint(
        "departments_abbreviation_key", "departments", type_="unique"
    )
    op.drop_column("departments", "users")
    op.drop_column("departments", "abbreviation")
