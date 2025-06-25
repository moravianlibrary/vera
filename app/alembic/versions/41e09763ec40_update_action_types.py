"""update action types

Revision ID: 41e09763ec40
Revises: a6c98f046826
Create Date: 2024-01-31 15:45:10.619990

"""

from alembic import op

# import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "41e09763ec40"
down_revision = "a6c98f046826"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            """
            CREATE TYPE new_actiontype AS ENUM (
                'ReadDatatableOwn',
                'ReadDatatableDepartment',
                'ReadDatatableAll',
                'EditDatatableOwn',
                'EditDatatableDepartment',
                'EditDatatableAll',
                'WriteDatatable',
                'InsertDatatable',
                'CommentOnDatatable',
                'ReadCategoriesAll',
                'ReadCategoriesDepartment',
                'EditCategoriesAll',
                'EditCategoriesDepartment',
                'ScheduleTasks',
                'AdminTasks',
                'EditAccess',
                'Extract',
                'AdminDatabase'
            );
        """
        )

        op.execute(
            """
            ALTER TABLE actions
            ADD COLUMN new_action_column new_actiontype;
        """
        )

        op.execute(
            """
            UPDATE actions
            SET new_action_column = CASE
                WHEN action = 'read_datatable_own'
                    THEN 'ReadDatatableOwn'::new_actiontype
                WHEN action = 'read_datatable_department'
                    THEN 'ReadDatatableDepartment'::new_actiontype
                WHEN action = 'read_datatable_all'
                    THEN 'ReadDatatableAll'::new_actiontype
                WHEN action = 'edit_datatable_own'
                    THEN 'EditDatatableOwn'::new_actiontype
                WHEN action = 'edit_datatable_department'
                    THEN 'EditDatatableDepartment'::new_actiontype
                WHEN action = 'edit_datatable_all'
                    THEN 'EditDatatableAll'::new_actiontype
                WHEN action = 'write_datatable'
                    THEN 'WriteDatatable'::new_actiontype
                WHEN action = 'insert_datatable'
                    THEN 'InsertDatatable'::new_actiontype
                WHEN action = 'comment_on_datatable'
                    THEN 'CommentOnDatatable'::new_actiontype
                WHEN action = 'edit_categories'
                    THEN 'EditCategoriesAll'::new_actiontype
                WHEN action = 'edit_access' THEN 'EditAccess'::new_actiontype
                WHEN action = 'extract' THEN 'Extract'::new_actiontype
            END;
        """
        )

        op.execute("ALTER TABLE actions DROP COLUMN action;")

        op.execute(
            "ALTER TABLE actions RENAME COLUMN new_action_column TO action;"
        )

        op.execute("DROP TYPE IF EXISTS actiontype;")

        op.execute("ALTER TYPE new_actiontype RENAME TO actiontype;")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            """
            CREATE TYPE old_actiontype AS ENUM (
                'read_datatable_own',
                'read_datatable_department',
                'read_datatable_all',
                'edit_datatable_own',
                'edit_datatable_department',
                'edit_datatable_all',
                'write_datatable',
                'insert_datatable',
                'comment_on_datatable',
                'edit_categories',
                'edit_access',
                'extract'
            )
        """
        )

        op.execute(
            """
            ALTER TABLE actions
            ADD COLUMN old_action_column old_actiontype;
        """
        )

        op.execute(
            """
            UPDATE actions
            SET old_action_column = CASE
                WHEN action = 'ReadDatatableOwn'
                    THEN 'read_datatable_own'::old_actiontype
                WHEN action = 'ReadDatatableDepartment'
                    THEN 'read_datatable_department'::old_actiontype
                WHEN action = 'ReadDatatableAll'
                    THEN 'read_datatable_all'::old_actiontype
                WHEN action = 'EditDatatableOwn'
                    THEN 'edit_datatable_own'::old_actiontype
                WHEN action = 'EditDatatableDepartment'
                    THEN 'edit_datatable_department'::old_actiontype
                WHEN action = 'EditDatatableAll'
                    THEN 'edit_datatable_all'::old_actiontype
                WHEN action = 'WriteDatatable'
                    THEN 'write_datatable'::old_actiontype
                WHEN action = 'InsertDatatable'
                    THEN 'insert_datatable'::old_actiontype
                WHEN action = 'CommentOnDatatable'
                    THEN 'comment_on_datatable'::old_actiontype
                WHEN action = 'EditCategoriesAll'
                    THEN 'edit_categories'::old_actiontype
                WHEN action = 'EditAccess' THEN 'edit_access'::old_actiontype
                WHEN action = 'Extract' THEN 'extract'::old_actiontype
            END;
        """
        )

        op.execute("ALTER TABLE actions DROP COLUMN action;")

        op.execute(
            "ALTER TABLE actions RENAME COLUMN old_action_column TO action;"
        )

        op.execute("DROP TYPE IF EXISTS actiontype;")

        op.execute("ALTER TYPE old_actiontype RENAME TO actiontype;")
