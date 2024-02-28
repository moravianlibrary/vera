"""make task document deletable

Revision ID: a68b77addb27
Revises: e5979e4eecd3
Create Date: 2024-02-28 18:54:39.251836

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a68b77addb27"
down_revision = "e5979e4eecd3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "task_documents",
        sa.Column(
            "deleted", sa.Boolean(), nullable=False, server_default="false"
        ),
    )

    op.drop_constraint(
        "task_documents_document_id_fkey",
        "task_documents",
        type_="foreignkey",
    )

    op.alter_column(
        "task_documents",
        "document_id",
        existing_type=sa.Integer(),
        type_=sa.Integer(),
    )


def downgrade() -> None:
    op.create_foreign_key(
        "task_documents_document_id_fkey",
        "task_documents",
        "documents",
        ["document_id"],
        ["id"],
    )

    op.drop_column("task_documents", "deleted")
