"""revision 2024.09-03

Revision ID: 203a0c700404
Revises: 0eb2681b5b34
Create Date: 2024-10-04 11:33:25.135345

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "203a0c700404"
down_revision = "0eb2681b5b34"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "task_items",
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column("item_id", sa.String(), nullable=False),
        sa.Column(
            "item_type",
            sa.Enum("CatalogRecord", "Document", name="taskitemtype"),
            nullable=False,
        ),
        sa.Column(
            "deleted", sa.Boolean(), server_default="false", nullable=True
        ),
        sa.Column(
            "processed", sa.Boolean(), server_default="false", nullable=True
        ),
        sa.Column(
            "error_type",
            sa.Enum("ValueError", "UnknownError", name="taskitemerrortype"),
            nullable=True,
        ),
        sa.Column("error_message", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["tasks.id"],
        ),
        sa.PrimaryKeyConstraint("task_id", "item_id", "item_type"),
    )
    op.create_index(
        op.f("ix_task_items_item_id"), "task_items", ["item_id"], unique=False
    )
    op.create_index(
        op.f("ix_task_items_task_id"), "task_items", ["task_id"], unique=False
    )

    # Copy task documents into task items
    op.execute(
        """
        INSERT INTO task_items (
            task_id,
            item_id,
            item_type,
            deleted,
            processed,
            error_type,
            error_message
        )
        SELECT
            task_id,
            CAST(document_id AS TEXT) AS item_id,
            'Document' AS item_type,
            deleted,
            processed,
            CASE
                WHEN error_type = 'ValueError'
                    THEN 'ValueError'::taskitemerrortype
                WHEN error_type = 'UnknownError'
                    THEN 'UnknownError'::taskitemerrortype
                ELSE NULL
            END AS error_type,
            error_message
        FROM
            task_documents
        """
    )

    op.drop_index("ix_task_documents_document_id", table_name="task_documents")
    op.drop_index("ix_task_documents_task_id", table_name="task_documents")
    op.drop_table("task_documents")
    op.execute("DROP TYPE IF EXISTS taskdocumenterrortype")

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
            'GenerateItemsPagesDataset'
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
            WHEN task_type = 'PredictPeriodicalPageCount'
                THEN 'PredictPeriodicalsPageCount'::new_tasktype
            WHEN task_type = 'Reindex'
                THEN 'ReindexDocuments'::new_tasktype
            WHEN task_type = 'SyncFromCatalogs'
                THEN 'SyncDocumentsWithCatalogs'::new_tasktype
            WHEN task_type = 'SyncFromDigitizationRegistry'
                THEN 'SyncDocumentsWithDigitizationRegistry'::new_tasktype
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
            WHEN task_type = 'PredictPeriodicalPageCount'
                THEN 'PredictPeriodicalsPageCount'::new_tasktype
            WHEN task_type = 'Reindex'
                THEN 'ReindexDocuments'::new_tasktype
            WHEN task_type = 'SyncFromCatalogs'
                THEN 'SyncDocumentsWithCatalogs'::new_tasktype
            WHEN task_type = 'SyncFromDigitizationRegistry'
                THEN 'SyncDocumentsWithDigitizationRegistry'::new_tasktype
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

    # Drop old task type enum and rename new one
    op.execute("DROP TYPE IF EXISTS tasktype;")
    op.execute("ALTER TYPE new_tasktype RENAME TO tasktype;")


def downgrade() -> None:
    op.create_table(
        "task_documents",
        sa.Column(
            "task_id", sa.INTEGER(), autoincrement=False, nullable=False
        ),
        sa.Column(
            "document_id", sa.INTEGER(), autoincrement=False, nullable=False
        ),
        sa.Column(
            "processed",
            sa.BOOLEAN(),
            server_default=sa.text("false"),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column(
            "error_type",
            postgresql.ENUM(
                "ValueError", "UnknownError", name="taskdocumenterrortype"
            ),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column(
            "error_message", sa.VARCHAR(), autoincrement=False, nullable=True
        ),
        sa.Column(
            "deleted",
            sa.BOOLEAN(),
            server_default=sa.text("false"),
            autoincrement=False,
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["task_id"], ["tasks.id"], name="task_documents_task_id_fkey"
        ),
        sa.PrimaryKeyConstraint(
            "task_id", "document_id", name="task_documents_pkey"
        ),
    )
    op.create_index(
        "ix_task_documents_task_id",
        "task_documents",
        ["task_id"],
        unique=False,
    )
    op.create_index(
        "ix_task_documents_document_id",
        "task_documents",
        ["document_id"],
        unique=False,
    )

    # Copy task items into task documents
    op.execute(
        """
        INSERT INTO task_documents (
            task_id,
            document_id,
            deleted,
            processed,
            error_type,
            error_message
        )
        SELECT
            task_id,
            CAST(item_id AS INTEGER) AS document_id,
            deleted,
            processed,
            CASE
                WHEN error_type = 'ValueError'
                    THEN 'ValueError'::taskdocumenterrortype
                WHEN error_type = 'UnknownError'
                    THEN 'UnknownError'::taskdocumenterrortype
                ELSE NULL
            END AS error_type,
            error_message
        FROM
            task_items
        WHERE
            item_type = 'Document'
        """
    )

    op.drop_index(op.f("ix_task_items_task_id"), table_name="task_items")
    op.drop_index(op.f("ix_task_items_item_id"), table_name="task_items")
    op.drop_table("task_items")
    op.execute("DROP TYPE IF EXISTS taskitemerrortype")
    op.execute("DROP TYPE IF EXISTS taskitemtype")

    # Recreate the old tasktype enum
    op.execute(
        """
        CREATE TYPE public.old_tasktype AS ENUM (
            'PredictPeriodicalPageCount',
            'Reindex',
            'SyncFromCatalogs',
            'SyncFromDigitizationRegistry',
            'GenerateVolumesPagesDataset',
            'GenerateItemsPagesDataset'
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
                THEN 'PredictPeriodicalPageCount'::old_tasktype
            WHEN task_type = 'ReindexDocuments'
                THEN 'Reindex'::old_tasktype
            WHEN task_type = 'SyncDocumentsWithCatalogs'
                THEN 'SyncFromCatalogs'::old_tasktype
            WHEN task_type = 'SyncDocumentsWithDigitizationRegistry'
                THEN 'SyncFromDigitizationRegistry'::old_tasktype
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
                THEN 'PredictPeriodicalPageCount'::old_tasktype
            WHEN task_type = 'ReindexDocuments'
                THEN 'Reindex'::old_tasktype
            WHEN task_type = 'SyncDocumentsWithCatalogs'
                THEN 'SyncFromCatalogs'::old_tasktype
            WHEN task_type = 'SyncDocumentsWithDigitizationRegistry'
                THEN 'SyncFromDigitizationRegistry'::old_tasktype
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

    # Drop the new tasktype enum
    op.execute("DROP TYPE IF EXISTS tasktype;")
    op.execute("ALTER TYPE old_tasktype RENAME TO tasktype;")
