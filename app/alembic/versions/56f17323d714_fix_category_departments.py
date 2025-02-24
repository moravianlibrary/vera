"""fix category departments

Revision ID: 56f17323d714
Revises: e2c92e404c1a
Create Date: 2024-05-31 17:59:50.765295

"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "56f17323d714"
down_revision = "e2c92e404c1a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM category_departments cd
        WHERE EXISTS (
            SELECT 1
            FROM categories c
            WHERE c.id = cd.category_id
            AND c.parent_id IN (
                SELECT cd2.category_id
                FROM category_departments cd2
            )
        );
        """
    )


def downgrade() -> None:
    pass
