"""documents - add locationUri

Revision ID: a51a57f94b30
Revises: a68b77addb27
Create Date: 2024-03-04 17:13:33.074869

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a51a57f94b30"
down_revision = "a68b77addb27"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column("locationUri", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("documents", "locationUri")
