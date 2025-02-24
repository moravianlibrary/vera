"""create table users

Revision ID: 44796b939a65
Revises: f400e723202f
Create Date: 2024-02-19 16:01:26.613363

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "44796b939a65"
down_revision = "f400e723202f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("username", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("username"),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
