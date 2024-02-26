"""change task documents error handling

Revision ID: 438f6a88a707
Revises: 59b5c2b5e72a
Create Date: 2024-02-19 16:41:45.439249

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "438f6a88a707"
down_revision = "59b5c2b5e72a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("task_documents", "error_type")
    op.execute("DROP TYPE IF EXISTS taskdocumenterrortype;")
    op.execute(
        """
        CREATE TYPE public.taskdocumenterrortype AS ENUM (
            'ValueError',
            'UnknownError'
        );
    """
    )
    op.add_column(
        "task_documents",
        sa.Column(
            "error_type",
            type_=sa.Enum(
                "taskdocumenterrortype", name="taskdocumenterrortype"
            ),
            nullable=True,
        ),
    )
    op.add_column(
        "task_documents",
        sa.Column("error_message", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("task_documents", "error_message")
    op.drop_column("task_documents", "error_type")
    op.execute("DROP TYPE IF EXISTS taskdocumenterrortype;")
    op.execute(
        """
        CREATE TYPE public.taskdocumenterrortype AS ENUM (
            'MissingVolume',
            'ConflictPagesCount'
        );
    """
    )
    op.add_column(
        "task_documents",
        sa.Column(
            "error_type",
            type_=sa.Enum(
                "taskdocumenterrortype", name="taskdocumenterrortype"
            ),
            nullable=True,
        ),
    )
