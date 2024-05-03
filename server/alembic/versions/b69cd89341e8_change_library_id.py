"""change library id

Revision ID: b69cd89341e8
Revises: 8e91710dadfe
Create Date: 2024-04-26 19:50:24.589465

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b69cd89341e8"
down_revision = "8e91710dadfe"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("locations")
    op.drop_table("storages")
    op.drop_table("libraries")
    op.execute("DROP TYPE location_state_type")

    op.create_table(
        "libraries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "storages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("library_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["library_id"],
            ["libraries.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", "library_id"),
    )
    op.create_table(
        "locations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("regexp", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("additional_info", sa.String(), nullable=True),
        sa.Column(
            "state",
            sa.Enum("Active", "Closed", name="location_state_type"),
            nullable=False,
        ),
        sa.Column("storage_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["storage_id"],
            ["storages.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", "storage_id"),
    )


def downgrade() -> None:
    op.drop_table("locations")
    op.drop_table("storages")
    op.drop_table("libraries")
    op.execute("DROP TYPE location_state_type")

    op.create_table(
        "libraries",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "storages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("library_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["library_id"],
            ["libraries.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "locations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("regexp", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("additional_info", sa.String(), nullable=True),
        sa.Column(
            "state",
            sa.Enum("LocationState", name="location_state_type"),
            nullable=False,
        ),
        sa.Column("storage_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["storage_id"],
            ["storages.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
