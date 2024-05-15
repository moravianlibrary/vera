"""revision of task datasets

Revision ID: bd255869e5d2
Revises: f1d65cda3eb5
Create Date: 2024-05-10 13:26:02.936121

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "bd255869e5d2"
down_revision = "f1d65cda3eb5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("task_csv_results")
    op.create_table(
        "task_datasets",
        sa.Column(
            "task_id",
            sa.Integer,
            sa.ForeignKey("tasks.id"),
            primary_key=True,
            index=True,
        ),
        sa.Column("data", sa.JSON),
        sa.Column("error_message", sa.String),
    )


def downgrade() -> None:
    op.drop_table("task_datasets")
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
