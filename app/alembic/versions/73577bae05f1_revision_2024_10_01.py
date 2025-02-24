"""revision_2024_10-01

Revision ID: 73577bae05f1
Revises: 203a0c700404
Create Date: 2024-10-11 21:36:44.669082

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "73577bae05f1"
down_revision = "203a0c700404"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create new task type enum
    op.execute(
        """
        CREATE TYPE public.new_tasktype AS ENUM (
            'PredictPeriodicalsPageCount',
            'ReindexDocuments',
            'SyncDocumentsWithCatalogs',
            'SyncDocumentsWithDigitizationRegistry',
            'ReindexCatalogRecords',
            'SyncCatalogRecordsWithCatalogs',
            'ReevaluateCatalogRecordsDifferences',
            'GenerateVolumesPagesDataset',
            'GenerateItemsPagesDataset',
            'RecreateIndexes'
        );
    """
    )

    # Replace old task type enum with new one in tasks table
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
            WHEN task_type = 'PredictPeriodicalsPageCount'
                THEN 'PredictPeriodicalsPageCount'::new_tasktype
            WHEN task_type = 'ReindexDocuments'
                THEN 'ReindexDocuments'::new_tasktype
            WHEN task_type = 'SyncDocumentsWithCatalogs'
                THEN 'SyncDocumentsWithCatalogs'::new_tasktype
            WHEN task_type = 'SyncDocumentsWithDigitizationRegistry'
                THEN 'SyncDocumentsWithDigitizationRegistry'::new_tasktype
            WHEN task_type = 'ReindexCatalogRecords'
                THEN 'ReindexCatalogRecords'::new_tasktype
            WHEN task_type = 'SyncCatalogRecordsWithCatalogs'
                THEN 'SyncCatalogRecordsWithCatalogs'::new_tasktype
            WHEN task_type = 'ReevaluateCatalogRecordsDifferences'
                THEN 'ReevaluateCatalogRecordsDifferences'::new_tasktype
            WHEN task_type = 'GenerateVolumesPagesDataset'
                THEN 'GenerateVolumesPagesDataset'::new_tasktype
            WHEN task_type = 'GenerateItemsPagesDataset'
                THEN 'GenerateItemsPagesDataset'::new_tasktype
        END;
    """
    )
    op.execute("ALTER TABLE tasks DROP COLUMN task_type;")
    op.execute("ALTER TABLE tasks RENAME COLUMN new_task_type TO task_type;")

    # Replace old task type enum with new one in periodic_tasks table
    op.add_column(
        "periodic_tasks",
        sa.Column(
            "new_task_type",
            type_=sa.Enum("new_tasktype", name="new_tasktype"),
            nullable=True,
        ),
    )
    op.execute(
        """
        UPDATE periodic_tasks
        SET new_task_type = CASE
            WHEN task_type = 'PredictPeriodicalsPageCount'
                THEN 'PredictPeriodicalsPageCount'::new_tasktype
            WHEN task_type = 'ReindexDocuments'
                THEN 'ReindexDocuments'::new_tasktype
            WHEN task_type = 'SyncDocumentsWithCatalogs'
                THEN 'SyncDocumentsWithCatalogs'::new_tasktype
            WHEN task_type = 'SyncDocumentsWithDigitizationRegistry'
                THEN 'SyncDocumentsWithDigitizationRegistry'::new_tasktype
            WHEN task_type = 'ReindexCatalogRecords'
                THEN 'ReindexCatalogRecords'::new_tasktype
            WHEN task_type = 'SyncCatalogRecordsWithCatalogs'
                THEN 'SyncCatalogRecordsWithCatalogs'::new_tasktype
            WHEN task_type = 'ReevaluateCatalogRecordsDifferences'
                THEN 'ReevaluateCatalogRecordsDifferences'::new_tasktype
            WHEN task_type = 'GenerateVolumesPagesDataset'
                THEN 'GenerateVolumesPagesDataset'::new_tasktype
            WHEN task_type = 'GenerateItemsPagesDataset'
                THEN 'GenerateItemsPagesDataset'::new_tasktype
        END;
    """
    )
    op.execute("ALTER TABLE periodic_tasks DROP COLUMN task_type;")
    op.execute(
        "ALTER TABLE periodic_tasks RENAME COLUMN new_task_type TO task_type;"
    )

    # Rename new task type enum to tasktype
    op.execute("DROP TYPE IF EXISTS tasktype;")
    op.execute("ALTER TYPE new_tasktype RENAME TO tasktype;")

    # Create new startup tasks table
    op.create_table(
        "startup_tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "task_type",
            type_=postgresql.ENUM(
                "PredictPeriodicalPageCount",
                "Reindex",
                "SyncFromCatalogs",
                "SyncFromDigitizationRegistry",
                "GenerateVolumesPagesDataset",
                "GenerateItemsPagesDataset",
                name="tasktype",
                create_type=False,
                checkfirst=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "item_type",
            type_=postgresql.ENUM(
                "CatalogRecord",
                "Document",
                name="taskitemtype",
                create_type=False,
                checkfirst=True,
            ),
            nullable=True,
        ),
        sa.Column(
            "is_one_time_task",
            sa.Boolean(),
            server_default="false",
            nullable=True,
        ),
        sa.Column(
            "has_run", sa.Boolean(), server_default="false", nullable=True
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_startup_tasks_id"), "startup_tasks", ["id"], unique=True
    )
    op.create_index(
        op.f("ix_tasks_task_type"), "tasks", ["task_type"], unique=False
    )
    
    op.execute(
        """
        UPDATE users SET settings = '{}'
        """
    )

    op.execute(
        """
        UPDATE roles
        SET actions = actions::jsonb || '["ReadCatalogRecords", "ReviewCatalogRecords"]'::jsonb
        WHERE name = 'Admin'
        """
    )

    op.execute(
        "INSERT INTO startup_tasks (task_type) VALUES ('RecreateIndexes');"
    )
    op.execute(
        """
        INSERT INTO startup_tasks (task_type, item_type, is_one_time_task)
        VALUES ('SyncCatalogRecordsWithCatalogs', 'CatalogRecord', TRUE);
    """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_tasks_task_type"), table_name="tasks")

    # Create old task type enum
    op.execute(
        """
        CREATE TYPE public.old_tasktype AS ENUM (
            'PredictPeriodicalsPageCount',
            'ReindexDocuments',
            'SyncDocumentsWithCatalogs',
            'SyncDocumentsWithDigitizationRegistry',
            'ReindexCatalogRecords',
            'SyncCatalogRecordsWithCatalogs',
            'ReevaluateCatalogRecordsDifferences',
            'GenerateVolumesPagesDataset',
            'GenerateItemsPagesDataset',
            'RecreateIndexes'
        );
    """
    )

    # Add back the old task_type column in the tasks table
    op.add_column(
        "tasks",
        sa.Column(
            "old_task_type",
            type_=sa.Enum("old_tasktype", name="old_tasktype"),
            nullable=True,
        ),
    )
    op.execute(
        """
        UPDATE tasks
        SET old_task_type = CASE
            WHEN task_type = 'PredictPeriodicalsPageCount'
                THEN 'PredictPeriodicalsPageCount'::old_tasktype
            WHEN task_type = 'ReindexDocuments'
                THEN 'ReindexDocuments'::old_tasktype
            WHEN task_type = 'SyncDocumentsWithCatalogs'
                THEN 'SyncDocumentsWithCatalogs'::old_tasktype
            WHEN task_type = 'SyncDocumentsWithDigitizationRegistry'
                THEN 'SyncDocumentsWithDigitizationRegistry'::old_tasktype
            WHEN task_type = 'ReindexCatalogRecords'
                THEN 'ReindexCatalogRecords'::old_tasktype
            WHEN task_type = 'SyncCatalogRecordsWithCatalogs'
                THEN 'SyncCatalogRecordsWithCatalogs'::old_tasktype
            WHEN task_type = 'ReevaluateCatalogRecordsDifferences'
                THEN 'ReevaluateCatalogRecordsDifferences'::old_tasktype
            WHEN task_type = 'GenerateVolumesPagesDataset'
                THEN 'GenerateVolumesPagesDataset'::old_tasktype
            WHEN task_type = 'GenerateItemsPagesDataset'
                THEN 'GenerateItemsPagesDataset'::old_tasktype
            ELSE NULL
        END;
        """
    )
    op.execute("ALTER TABLE tasks DROP COLUMN task_type;")
    op.execute("ALTER TABLE tasks RENAME COLUMN old_task_type TO task_type;")

    # Add back the old task_type column in the periodic_tasks table
    op.add_column(
        "periodic_tasks",
        sa.Column(
            "old_task_type",
            type_=sa.Enum("old_tasktype", name="old_tasktype"),
            nullable=True,
        ),
    )
    op.execute(
        """
        UPDATE periodic_tasks
        SET old_task_type = CASE
            WHEN task_type = 'PredictPeriodicalsPageCount'
                THEN 'PredictPeriodicalsPageCount'::old_tasktype
            WHEN task_type = 'ReindexDocuments'
                THEN 'ReindexDocuments'::old_tasktype
            WHEN task_type = 'SyncDocumentsWithCatalogs'
                THEN 'SyncDocumentsWithCatalogs'::old_tasktype
            WHEN task_type = 'SyncDocumentsWithDigitizationRegistry'
                THEN 'SyncDocumentsWithDigitizationRegistry'::old_tasktype
            WHEN task_type = 'ReindexCatalogRecords'
                THEN 'ReindexCatalogRecords'::old_tasktype
            WHEN task_type = 'SyncCatalogRecordsWithCatalogs'
                THEN 'SyncCatalogRecordsWithCatalogs'::old_tasktype
            WHEN task_type = 'ReevaluateCatalogRecordsDifferences'
                THEN 'ReevaluateCatalogRecordsDifferences'::old_tasktype
            WHEN task_type = 'GenerateVolumesPagesDataset'
                THEN 'GenerateVolumesPagesDataset'::old_tasktype
            WHEN task_type = 'GenerateItemsPagesDataset'
                THEN 'GenerateItemsPagesDataset'::old_tasktype
            ELSE NULL
        END;
        """
    )
    op.execute("ALTER TABLE periodic_tasks DROP COLUMN task_type;")
    op.execute(
        "ALTER TABLE periodic_tasks RENAME COLUMN old_task_type TO task_type;"
    )

    # Drop the startup tasks table
    op.drop_index(op.f("ix_startup_tasks_id"), table_name="startup_tasks")
    op.drop_table("startup_tasks")

    # Rename old task type enum to tasktype
    op.execute("DROP TYPE IF EXISTS tasktype;")
    op.execute("ALTER TYPE old_tasktype RENAME TO tasktype;")
