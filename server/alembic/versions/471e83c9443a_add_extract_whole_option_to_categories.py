"""add extract whole option to categories

Revision ID: 471e83c9443a
Revises: 148513c185c4
Create Date: 2024-02-19 17:17:30.191920

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "471e83c9443a"
down_revision = "148513c185c4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "categories", sa.Column("extract_whole", sa.Boolean(), nullable=True)
    )
    op.execute("UPDATE categories SET extract_whole = false;")


def downgrade() -> None:
    op.drop_column("categories", "extract_whole")
