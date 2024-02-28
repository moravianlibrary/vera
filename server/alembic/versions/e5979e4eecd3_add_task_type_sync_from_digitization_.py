"""add task type - sync from digitization registry

Revision ID: e5979e4eecd3
Revises: 471e83c9443a
Create Date: 2024-02-28 11:06:17.691843

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e5979e4eecd3"
down_revision = "471e83c9443a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TYPE public.new_tasktype AS ENUM (
            'PredictVolumePages',
            'SyncFromCatalog',
            'SyncFromDigitizationRegistry'
        );
    """
    )
    op.add_column(
        "tasks",
        sa.Column(
            "new_task_type",
            type_=sa.Enum("new_tasktype", name="new_tasktype"),
            nullable=True,
        ),
    )

    op.execute(
        """
        UPDATE tasks
        SET new_task_type = CASE
            WHEN task_type = 'PredictVolumePages'
                THEN 'PredictVolumePages'::new_tasktype
            WHEN task_type = 'SyncFromCatalog'
                THEN 'SyncFromCatalog'::new_tasktype
        END;
    """
    )

    op.execute("ALTER TABLE tasks DROP COLUMN task_type;")

    op.execute("ALTER TABLE tasks RENAME COLUMN new_task_type TO task_type;")

    op.execute("DROP TYPE IF EXISTS tasktype;")

    op.execute("ALTER TYPE new_tasktype RENAME TO tasktype;")


def downgrade() -> None:
    op.execute(
        """
        CREATE TYPE public.new_tasktype AS ENUM (
            'PredictVolumePages',
            'SyncFromCatalog',
        );
    """
    )

    op.add_column(
        "tasks",
        sa.Column(
            "new_task_type",
            type_=sa.Enum("new_tasktype", name="new_tasktype"),
            nullable=True,
        ),
    )

    op.execute(
        """
        UPDATE tasks
        SET new_task_type = CASE
            WHEN task_type = 'PredictVolumePages'
                THEN 'PredictVolumePages'::new_tasktype
            WHEN task_type = 'SyncFromCatalog'
                THEN 'SyncFromCatalog'::new_tasktype
        END;
    """
    )

    op.execute("ALTER TABLE tasks DROP COLUMN task_type;")

    op.execute("ALTER TABLE tasks RENAME COLUMN new_task_type TO task_type;")

    op.execute("DROP TYPE IF EXISTS tasktype;")

    op.execute("ALTER TYPE new_tasktype RENAME TO tasktype;")
