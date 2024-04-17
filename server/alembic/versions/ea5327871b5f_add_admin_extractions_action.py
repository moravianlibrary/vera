"""add admin extractions action

Revision ID: ea5327871b5f
Revises: c6f622d9ccbe
Create Date: 2024-04-17 11:05:38.641937

"""

from alembic import op

# import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "ea5327871b5f"
down_revision = "c6f622d9ccbe"
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
                'InsertDatatable',
                'EditDatatableOwn',
                'EditDatatableDepartment',
                'EditDatatableAll',
                'WriteDatatable',
                'CommentOnDatatable',
                'ReadCategoriesAll',
                'ReadCategoriesDepartment',
                'EditCategoriesAll',
                'EditCategoriesDepartment',
                'PlanTasks',
                'AdminTasks',
                'EditAccess',
                'Extract',
                'AdminExtractions',
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
                WHEN action = 'ReadDatatableOwn'
                    THEN 'ReadDatatableOwn'::new_actiontype
                WHEN action = 'ReadDatatableDepartment'
                    THEN 'ReadDatatableDepartment'::new_actiontype
                WHEN action = 'ReadDatatableAll'
                    THEN 'ReadDatatableAll'::new_actiontype
                WHEN action = 'InsertDatatable'
                    THEN 'InsertDatatable'::new_actiontype
                WHEN action = 'EditDatatableOwn'
                    THEN 'EditDatatableOwn'::new_actiontype
                WHEN action = 'EditDatatableDepartment'
                    THEN 'EditDatatableDepartment'::new_actiontype
                WHEN action = 'EditDatatableAll'
                    THEN 'EditDatatableAll'::new_actiontype
                WHEN action = 'WriteDatatable'
                    THEN 'WriteDatatable'::new_actiontype
                WHEN action = 'CommentOnDatatable'
                    THEN 'CommentOnDatatable'::new_actiontype
                WHEN action = 'ReadCategoriesAll'
                    THEN 'ReadCategoriesAll'::new_actiontype
                WHEN action = 'ReadCategoriesDepartment'
                    THEN 'ReadCategoriesDepartment'::new_actiontype
                WHEN action = 'EditCategoriesAll'
                    THEN 'EditCategoriesAll'::new_actiontype
                WHEN action = 'EditCategoriesDepartment'
                    THEN 'EditCategoriesDepartment'::new_actiontype
                WHEN action = 'PlanTasks' THEN 'PlanTasks'::new_actiontype
                WHEN action = 'AdminTasks' THEN 'AdminTasks'::new_actiontype
                WHEN action = 'EditAccess' THEN 'EditAccess'::new_actiontype
                WHEN action = 'Extract' THEN 'Extract'::new_actiontype
                WHEN action = 'AdminDatabase'
                    THEN 'AdminDatabase'::new_actiontype
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
            SET new_action_column = CASE
                WHEN action = 'ReadDatatableOwn'
                    THEN 'ReadDatatableOwn'::new_actiontype
                WHEN action = 'ReadDatatableDepartment'
                    THEN 'ReadDatatableDepartment'::new_actiontype
                WHEN action = 'ReadDatatableAll'
                    THEN 'ReadDatatableAll'::new_actiontype
                WHEN action = 'InsertDatatable'
                    THEN 'InsertDatatable'::new_actiontype
                WHEN action = 'EditDatatableOwn'
                    THEN 'EditDatatableOwn'::new_actiontype
                WHEN action = 'EditDatatableDepartment'
                    THEN 'EditDatatableDepartment'::new_actiontype
                WHEN action = 'EditDatatableAll'
                    THEN 'EditDatatableAll'::new_actiontype
                WHEN action = 'WriteDatatable'
                    THEN 'WriteDatatable'::new_actiontype
                WHEN action = 'CommentOnDatatable'
                    THEN 'CommentOnDatatable'::new_actiontype
                WHEN action = 'ReadCategoriesAll'
                    THEN 'ReadCategoriesAll'::new_actiontype
                WHEN action = 'ReadCategoriesDepartment'
                    THEN 'ReadCategoriesDepartment'::new_actiontype
                WHEN action = 'EditCategoriesAll'
                    THEN 'EditCategoriesAll'::new_actiontype
                WHEN action = 'EditCategoriesDepartment'
                    THEN 'EditCategoriesDepartment'::new_actiontype
                WHEN action = 'PlanTasks' THEN 'PlanTasks'::new_actiontype
                WHEN action = 'AdminTasks' THEN 'AdminTasks'::new_actiontype
                WHEN action = 'EditAccess' THEN 'EditAccess'::new_actiontype
                WHEN action = 'Extract' THEN 'Extract'::new_actiontype
                WHEN action = 'AdminDatabase'
                    THEN 'AdminDatabase'::new_actiontype
            END;
        """
        )

        op.execute("ALTER TABLE actions DROP COLUMN action;")

        op.execute(
            "ALTER TABLE actions RENAME COLUMN old_action_column TO action;"
        )

        op.execute("DROP TYPE IF EXISTS actiontype;")

        op.execute("ALTER TYPE old_actiontype RENAME TO actiontype;")
