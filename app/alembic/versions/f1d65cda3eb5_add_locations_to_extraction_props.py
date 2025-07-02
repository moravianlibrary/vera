"""add locations to extraction props

Revision ID: f1d65cda3eb5
Revises: b69cd89341e8
Create Date: 2024-04-30 15:10:01.051320

"""

import sqlalchemy as sa
from sqlalchemy import ARRAY

from alembic import op

# revision identifiers, used by Alembic.
revision = "f1d65cda3eb5"
down_revision = "b69cd89341e8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "generated_extractions",
        sa.Column("location_ids", ARRAY(sa.int), server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("generated_extractions", "location_ids")
