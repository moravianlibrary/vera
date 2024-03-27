"""create task_csv_results table

Revision ID: 8b07c135d752
Revises: a51a57f94b30
Create Date: 2024-03-27 17:00:18.805768

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "8b07c135d752"
down_revision = "a51a57f94b30"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "task_csv_results",
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column("data", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["tasks.id"],
        ),
        sa.PrimaryKeyConstraint("task_id"),
    )


def downgrade():
    op.drop_table("task_csv_results")
