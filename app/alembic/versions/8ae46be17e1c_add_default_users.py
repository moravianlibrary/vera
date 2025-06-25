"""add default users

Revision ID: 8ae46be17e1c
Revises: 41e09763ec40
Create Date: 2024-02-16 17:02:51.850640

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "8ae46be17e1c"
down_revision = "41e09763ec40"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create role 'Admin'
    op.execute(
        "INSERT INTO roles (name) VALUES ('Admin') ON CONFLICT DO NOTHING;"
    )

    actions = [
        "ReadDatatableAll",
        "EditDatatableAll",
        "WriteDatatable",
        "InsertDatatable",
        "CommentOnDatatable",
        "ReadCategoriesAll",
        "EditCategoriesAll",
        "ScheduleTasks",
        "AdminTasks",
        "EditAccess",
        "Extract",
        "AdminDatabase",
    ]
    for action in actions:
        op.execute(
            f"INSERT INTO actions (role_id, action) VALUES "
            f"((SELECT id FROM roles WHERE name='Admin'), '{action}');"
        )

    # Create role 'HeadOfDepartment'
    op.execute(
        "INSERT INTO roles (name) VALUES ('HeadOfDepartment') "
        "ON CONFLICT DO NOTHING;"
    )

    actions = [
        "ReadDatatableDepartment",
        "EditDatatableDepartment",
        "InsertDatatable",
        "CommentOnDatatable",
        "ReadCategoriesDepartment",
        "EditCategoriesDepartment",
        "ScheduleTasks",
    ]
    for action in actions:
        op.execute(
            f"INSERT INTO actions (role_id, action) VALUES "
            f"((SELECT id FROM roles "
            f"WHERE name='HeadOfDepartment'), '{action}');"
        )

    # Create role 'User'
    op.execute(
        "INSERT INTO roles (name) VALUES ('User') ON CONFLICT DO NOTHING;"
    )

    actions = [
        "ReadDatatableDepartment",
        "EditDatatableOwn",
        "InsertDatatable",
        "CommentOnDatatable",
        "ReadCategoriesDepartment",
        "ScheduleTasks",
    ]
    for action in actions:
        op.execute(
            f"INSERT INTO actions (role_id, action) VALUES "
            f"((SELECT id FROM roles WHERE name='User'), '{action}');"
        )


def downgrade() -> None:
    pass
