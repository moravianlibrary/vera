"""v2024-11

Revision ID: 63b3123f29a6
Revises: bff6e9bf48c1
Create Date: 2024-11-19 15:06:04.711841

"""

from alembic import op


revision = "63b3123f29a6"
down_revision = "bff6e9bf48c1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
    UPDATE users
        SET settings = (
            settings::jsonb || '{"newVersion": true}'::jsonb
        )::json;
    """
    )
