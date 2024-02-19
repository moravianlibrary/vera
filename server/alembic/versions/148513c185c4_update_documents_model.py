"""update documents model

Revision ID: 148513c185c4
Revises: 438f6a88a707
Create Date: 2024-02-19 16:50:55.732996

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "148513c185c4"
down_revision = "438f6a88a707"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TYPE public.issuancetype AS ENUM (
            'Unit',
            'Volume',
            'Bundle'
        );
    """
    )
    op.drop_constraint(
        "documents_sysno_volume_number_barcode_key",
        "documents",
        type_="unique",
    )

    op.alter_column("documents", "volume_number", new_column_name="volume")
    op.alter_column("documents", "ccnb", new_column_name="cnb")
    op.alter_column("documents", "isbn", new_column_name="isbn_issn")

    op.drop_column("documents", "publishers")
    op.drop_column("documents", "places")
    op.drop_column("documents", "frequencies")

    op.add_column(
        "documents",
        sa.Column(
            "issuance_type",
            sa.Enum("issuancetype", name="issuancetype"),
            nullable=True,
        ),
    )
    op.add_column("documents", sa.Column("year", sa.String(), nullable=True))
    op.add_column("documents", sa.Column("bundle", sa.String(), nullable=True))
    op.add_column(
        "documents", sa.Column("publisher", sa.String(), nullable=True)
    )
    op.add_column(
        "documents", sa.Column("publishing_place", sa.String(), nullable=True)
    )
    op.add_column(
        "documents", sa.Column("publishing_year", sa.String(), nullable=True)
    )
    op.add_column(
        "documents", sa.Column("frequencies", sa.JSON(), nullable=True)
    )

    op.create_unique_constraint(
        "documents_sysno_volume_barcode_key",
        "documents",
        ["sysno", "volume", "barcode"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "documents_sysno_volume_barcode_key", "documents", type_="unique"
    )

    op.drop_column("documents", "frequencies")
    op.drop_column("documents", "publishing_year")
    op.drop_column("documents", "publishing_place")
    op.drop_column("documents", "publisher")
    op.drop_column("documents", "bundle")
    op.drop_column("documents", "year")
    op.drop_column("documents", "issuance_type")

    op.add_column(
        "documents",
        sa.Column("frequencies", sa.ARRAY(sa.String()), nullable=True),
    )
    op.add_column(
        "documents", sa.Column("places", sa.ARRAY(sa.String()), nullable=True)
    )
    op.add_column(
        "documents",
        sa.Column("publishers", sa.ARRAY(sa.String()), nullable=True),
    )

    op.alter_column("documents", "isbn_issn", new_column_name="isbn")
    op.alter_column("documents", "cnb", new_column_name="ccnb")
    op.alter_column("documents", "volume", new_column_name="volume_number")

    op.execute("DROP TYPE IF EXISTS public.issuancetype;")
    op.create_unique_constraint(
        "documents_sysno_volume_number_barcode_key",
        "documents",
        ["sysno", "volume_number", "barcode"],
    )
