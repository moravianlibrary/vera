"""add dataset generation task types

Revision ID: 35b7a708adec
Revises: 8b07c135d752
Create Date: 2024-03-27 17:07:07.415506

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "35b7a708adec"
down_revision = "8b07c135d752"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TYPE public.new_tasktype AS ENUM (
            'PredictVolumePages',
            'SyncFromCatalog',
            'SyncFromDigitizationRegistry',
            'GenerateVolumesPagesDataset',
            'GenerateItemsPagesDataset'
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
            WHEN task_type = 'SyncFromDigitizationRegistry'
                THEN 'SyncFromDigitizationRegistry'::new_tasktype
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
            WHEN task_type = 'SyncFromDigitizationRegistry'
                THEN 'SyncFromDigitizationRegistry'::new_tasktype
        END;
    """
    )

    op.execute("ALTER TABLE tasks DROP COLUMN task_type;")

    op.execute("ALTER TABLE tasks RENAME COLUMN new_task_type TO task_type;")

    op.execute("DROP TYPE IF EXISTS tasktype;")

    op.execute("ALTER TYPE new_tasktype RENAME TO tasktype;")
