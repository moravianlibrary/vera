"""categories intentions rework

Revision ID: e2c92e404c1a
Revises: bd255869e5d2
Create Date: 2024-05-30 10:14:43.833317

"""

from datetime import datetime, timedelta

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "e2c92e404c1a"
down_revision = "bd255869e5d2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "documents", "pages_count", new_column_name="pages_count_catalog"
    )

    op.create_table(
        "intentions",
        sa.Column("id", sa.int(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("target_page_count", sa.int(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "distributions",
        sa.Column(
            "intention_id",
            sa.int(),
            sa.ForeignKey("intentions.id"),
            index=True,
        ),
        sa.Column(
            "category_id",
            sa.int(),
            sa.ForeignKey("categories.id"),
            index=True,
        ),
        sa.Column("percentage", sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint("intention_id", "category_id"),
        sa.UniqueConstraint("intention_id", "category_id"),
    )

    today = datetime.now().date()
    next_month = today.replace(day=28) + timedelta(days=4)
    end_date = next_month - timedelta(days=next_month.day)
    op.execute(
        "INSERT INTO intentions "
        "(name, target_page_count, start_date, end_date) "
        f"VALUES ('Intitial Intention', 100000, '2024-01-01', '{end_date}')"
    )
    op.execute(
        "INSERT INTO distributions (intention_id, category_id, percentage) "
        "SELECT 1, id, percentage FROM categories"
    )

    op.drop_column("categories", "percentage")


def downgrade() -> None:
    op.alter_column(
        "documents", "pages_count_catalog", new_column_name="pages_count"
    )
    op.add_column(
        "categories", sa.Column("percentage", sa.Float(), nullable=True)
    )

    distributions = (
        op.get_bind()
        .execute(
            "SELECT category_id, percentage "
            "FROM distributions WHERE intention_id = 1"
        )
        .fetchall()
    )
    for category_id, percentage in distributions:
        op.execute(
            f"UPDATE categories SET percentage = {percentage} "
            f"WHERE id = {category_id}"
        )

    op.drop_table("distributions")
    op.drop_table("intentions")
