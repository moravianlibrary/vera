"""Revision 2024.09-01

Revision ID: a4dfecbb1260
Revises: 80a0a683bc0f
Create Date: 2024-09-16 15:07:45.838983

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "a4dfecbb1260"
down_revision = "80a0a683bc0f"
branch_labels = None
depends_on = None

VALID_MARC_BYTES = "00048    a2200037   4500001001000000\x1e000121929\x1e\x1d"


def upgrade_catalog_records_and_documents_tables() -> None:
    # CATALOG RECORDS
    op.create_table(
        "catalog_records",
        sa.Column("sysno", sa.String(), nullable=False),
        sa.Column("marc", sa.LargeBinary(), nullable=False),
        sa.Column("cnb", sa.String(), nullable=True),
        sa.Column("language", sa.String(), nullable=False),
        sa.Column("signature", sa.String(), nullable=True),
        sa.Column("isxn", sa.String(), nullable=True),
        sa.Column("skc_sysno", sa.String(), nullable=True),
        sa.Column("skc_marc", sa.LargeBinary(), nullable=True),
        sa.Column("cnb_sysno", sa.String(), nullable=True),
        sa.Column("cnb_marc", sa.LargeBinary(), nullable=True),
        sa.Column(
            "last_updated",
            sa.TIMESTAMP(),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("sysno"),
    )
    op.create_index(
        op.f("ix_catalog_records_sysno"),
        "catalog_records",
        ["sysno"],
        unique=True,
    )
    op.create_table(
        "catalog_record_barcode",
        sa.Column("sysno", sa.String(), nullable=False),
        sa.Column("barcode", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["sysno"],
            ["catalog_records.sysno"],
        ),
        sa.PrimaryKeyConstraint("sysno", "barcode"),
    )
    op.create_table(
        "catalog_record_field_differences",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("sysno", sa.String(), nullable=True),
        sa.Column(
            "source",
            sa.Enum("SKC", "CNB", name="catalogsource"),
            nullable=False,
        ),
        sa.Column("tag", sa.String(), nullable=False),
        sa.Column("indicator1", sa.String(), nullable=True),
        sa.Column("indicator2", sa.String(), nullable=True),
        sa.Column(
            "difference_type",
            sa.Enum(
                "Equal",
                "DifferentValue",
                "ExtraField",
                "MissingField",
                name="marcfielddifferencetype",
            ),
            nullable=False,
        ),
        sa.Column("approved_by", sa.String(), nullable=True),
        sa.Column("approved_at", sa.TIMESTAMP(), nullable=True),
        sa.Column(
            "deleted", sa.Boolean(), server_default="false", nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["sysno"],
            ["catalog_records.sysno"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_catalog_record_field_differences_indicator1"),
        "catalog_record_field_differences",
        ["indicator1"],
        unique=False,
    )
    op.create_index(
        op.f("ix_catalog_record_field_differences_indicator2"),
        "catalog_record_field_differences",
        ["indicator2"],
        unique=False,
    )
    op.create_index(
        op.f("ix_catalog_record_field_differences_source"),
        "catalog_record_field_differences",
        ["source"],
        unique=False,
    )
    op.create_index(
        op.f("ix_catalog_record_field_differences_sysno"),
        "catalog_record_field_differences",
        ["sysno"],
        unique=False,
    )
    op.create_index(
        op.f("ix_catalog_record_field_differences_tag"),
        "catalog_record_field_differences",
        ["tag"],
        unique=False,
    )
    op.create_table(
        "catalog_record_subfield_differences",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("field_difference_id", sa.Integer(), nullable=True),
        sa.Column("code", sa.String(), nullable=True),
        sa.Column("value", sa.String(), nullable=True),
        sa.Column("different_to", sa.String(), nullable=True),
        sa.Column("differs", sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(
            ["field_difference_id"],
            ["catalog_record_field_differences.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_catalog_record_subfield_differences_code"),
        "catalog_record_subfield_differences",
        ["code"],
        unique=False,
    )
    op.create_index(
        op.f("ix_catalog_record_subfield_differences_field_difference_id"),
        "catalog_record_subfield_differences",
        ["field_difference_id"],
        unique=False,
    )

    # DOCUMENTS - non-harmful changes
    op.add_column(
        "documents",
        sa.Column("document_signature", sa.String(), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("digitization_registry_id", sa.Integer(), nullable=True),
    )
    op.alter_column(
        "documents", "sysno", existing_type=sa.VARCHAR(), nullable=True
    )
    op.alter_column(
        "documents",
        "digitization_state",
        existing_type=postgresql.ENUM(
            "Finished",
            "InProgress",
            "Planned",
            "NotDigitized",
            name="digitizationstate",
        ),
        nullable=False,
    )
    op.alter_column(
        "documents",
        "extraction_priority",
        existing_type=sa.INTEGER(),
        comment=None,
        existing_comment="Priority of extraction (1-5)",
        existing_nullable=False,
        existing_server_default=sa.text("3"),
    )

    # DOCUMENTS - changing isbn_issn to isxn
    op.alter_column(
        "documents",
        "isbn_issn",
        new_column_name="isxn",
        existing_type=sa.String(),
        existing_nullable=True,
    )

    # DOCUMENTS - setting sysno as foreign key
    op.execute(
        sa.text(
            f"""
            INSERT INTO catalog_records
            (sysno, cnb, signature, isxn, marc, language)
            SELECT DISTINCT ON (d.sysno) d.sysno, d.cnb, d.signature, d.isxn,
                '{VALID_MARC_BYTES}',
                CASE
                    WHEN ARRAY_LENGTH(d.languages, 1) > 0 THEN d.languages[1]
                    ELSE 'cze'
                END
            FROM documents d
            """
        )
    )
    op.create_foreign_key(
        None, "documents", "catalog_records", ["sysno"], ["sysno"]
    )

    # DOCUMENTS - removing unused columns
    op.drop_column("documents", "size")
    op.drop_column("documents", "cnb")
    op.drop_column("documents", "publishing_place")
    op.drop_column("documents", "year")
    op.drop_column("documents", "frequencies")
    op.drop_column("documents", "title")
    op.drop_column("documents", "signature")
    op.drop_column("documents", "locationUri")
    op.drop_column("documents", "publisher")
    op.drop_column("documents", "languages")
    op.drop_column("documents", "alternative_ids")
    op.drop_column("documents", "material_type")

    # DOCUMENTS - changing created_at to added_at
    op.alter_column(
        "documents",
        "created_at",
        new_column_name="added_at",
        existing_type=sa.TIMESTAMP(),
        existing_server_default=sa.text("now()"),
        existing_nullable=True,
    )

    # DOCUMENTS - changing creator to added_by
    op.drop_index("ix_documents_creator", table_name="documents")
    op.alter_column(
        "documents",
        "creator",
        new_column_name="added_by",
        existing_type=sa.String(),
        existing_nullable=True,
    )
    op.create_index(
        op.f("ix_documents_added_by"), "documents", ["added_by"], unique=False
    )

    # DOCUMENTS - changing extraction_id to digitization_list_id
    op.drop_constraint(
        "documents_extraction_id_fkey", "documents", type_="foreignkey"
    )
    op.drop_index("ix_documents_extraction_id", table_name="documents")
    op.alter_column(
        "documents",
        "extraction_id",
        new_column_name="digitization_list_id",
        existing_type=sa.Integer(),
        existing_nullable=True,
    )
    op.create_foreign_key(
        None,
        "documents",
        "digitization_lists",
        ["digitization_list_id"],
        ["id"],
    )
    op.create_index(
        op.f("ix_documents_digitization_list_id"),
        "documents",
        ["digitization_list_id"],
        unique=False,
    )

    # DOCUMENTS - changing publishing_year to volume_year
    op.alter_column(
        "documents",
        "publishing_year",
        new_column_name="volume_year",
        existing_type=sa.String(),
        existing_nullable=True,
    )

    # DOCUMENTS - change unique constraint
    op.drop_constraint(
        "documents_sysno_volume_barcode_key", "documents", type_="unique"
    )
    op.create_unique_constraint(
        None,
        "documents",
        ["sysno", "barcode", "volume", "volume_year", "bundle"],
    )


def upgrade_digitization_lists() -> None:
    # DIGITIZATION LISTS - changing table name
    op.drop_constraint(
        "digitization_extractions_intention_id_fkey",
        "digitization_extractions",
        type_="foreignkey",
    )
    op.rename_table("digitization_extractions", "digitization_lists")
    op.create_foreign_key(
        None,
        "digitization_lists",
        "intentions",
        ["intention_id"],
        ["id"],
    )
    op.create_index(
        op.f("ix_digitization_lists_id"),
        "digitization_lists",
        ["id"],
        unique=True,
    )
    # DIGITIZATION LISTS - changing extracted_at to created_at
    op.alter_column(
        "digitization_lists",
        "extracted_at",
        new_column_name="created_at",
        existing_type=sa.TIMESTAMP(),
        existing_server_default=sa.text("now()"),
        existing_nullable=True,
    )
    # DIGITIZATION LISTS - changing extractor to created_by
    op.alter_column(
        "digitization_lists",
        "extractor",
        new_column_name="created_by",
        existing_type=sa.String(),
        existing_nullable=True,
    )
    op.create_index(
        op.f("ix_digitization_lists_created_by"),
        "digitization_lists",
        ["created_by"],
        unique=False,
    )


def upgrade_periodic_tasks() -> None:
    op.create_table(
        "periodic_tasks",
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
        sa.Column("query_params", sa.JSON(), nullable=True),
        sa.Column("minute", sa.Integer(), nullable=False),
        sa.Column("hour", sa.Integer(), nullable=True),
        sa.Column("day_of_week", sa.Integer(), nullable=True),
        sa.Column("day_of_month", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_periodic_tasks_id"), "periodic_tasks", ["id"], unique=True
    )


def upgrade_tasks() -> None:
    op.alter_column(
        "tasks",
        "task_type",
        existing_type=postgresql.ENUM(
            "PredictVolumePages",
            "SyncFromCatalog",
            "SyncFromDigitizationRegistry",
            "GenerateVolumesPagesDataset",
            "GenerateItemsPagesDataset",
            name="tasktype",
        ),
        nullable=False,
    )
    op.alter_column(
        "tasks", "owner", existing_type=sa.VARCHAR(), nullable=False
    )
    op.drop_column("tasks", "query")
    op.add_column(
        "tasks",
        sa.Column("query_params", sa.JSON(), nullable=True),
    )
    op.alter_column(
        "tasks",
        "task_state",
        existing_type=postgresql.ENUM(
            "Planned",
            "Running",
            "Finished",
            "Failed",
            "Killed",
            name="taskstate",
        ),
        nullable=False,
        existing_server_default=sa.text("'Planned'::taskstate"),
    )
    op.create_index(
        op.f("ix_tasks_task_type"), "tasks", ["task_type"], unique=False
    )


def upgrade_categories() -> None:
    op.drop_index("ix_categories_quotas_id", table_name="categories_quotas")
    op.drop_table("categories_quotas")
    op.alter_column(
        "categories", "name", existing_type=sa.VARCHAR(), nullable=False
    )
    op.alter_column(
        "categories", "level", existing_type=sa.INTEGER(), nullable=False
    )
    op.alter_column(
        "categories", "assignable", existing_type=sa.BOOLEAN(), nullable=False
    )


def upgrade_departments() -> None:
    op.alter_column(
        "departments",
        "abbreviation",
        existing_type=sa.VARCHAR(),
        nullable=False,
    )
    op.alter_column(
        "departments", "name", existing_type=sa.VARCHAR(), nullable=False
    )
    op.drop_column("departments", "users")


def upgrade_document_comments() -> None:
    op.drop_constraint(
        "comments_document_id_fkey", "comments", type_="foreignkey"
    )
    op.create_foreign_key(
        None,
        "comments",
        "documents",
        ["document_id"],
        ["id"],
        ondelete="CASCADE",
    )


def upgrade_generated_extractions() -> None:
    op.alter_column(
        "generated_extractions",
        "document_ids",
        existing_type=postgresql.ARRAY(sa.INTEGER()),
        type_=sa.JSON(),
        existing_nullable=True,
        postgresql_using="int_array_to_jsonb(document_ids)",
    )
    op.alter_column(
        "generated_extractions",
        "include_categories",
        existing_type=postgresql.ARRAY(sa.INTEGER()),
        type_=sa.JSON(),
        existing_nullable=True,
        postgresql_using="int_array_to_jsonb(include_categories)",
    )
    op.execute(
        """
        ALTER TABLE generated_extractions
        ALTER COLUMN location_ids DROP DEFAULT;
        """
    )
    op.alter_column(
        "generated_extractions",
        "location_ids",
        existing_type=postgresql.ARRAY(sa.INTEGER()),
        type_=sa.JSON(),
        existing_nullable=True,
        postgresql_using="int_array_to_jsonb(location_ids)",
    )
    op.create_index(
        op.f("ix_generated_extractions_generated_by"),
        "generated_extractions",
        ["generated_by"],
        unique=False,
    )
    op.create_index(
        op.f("ix_generated_extractions_id"),
        "generated_extractions",
        ["id"],
        unique=True,
    )


def upgrade_locations() -> None:
    op.execute(
        """
        CREATE TYPE locationstate AS ENUM ('Active', 'Closed');
        """
    )
    op.alter_column(
        "locations",
        "state",
        existing_type=postgresql.ENUM(
            "Active", "Closed", name="location_state_type"
        ),
        type_=sa.Enum("Active", "Closed", name="locationstate"),
        existing_nullable=False,
        postgresql_using="state::text::locationstate",
    )
    op.execute("DROP TYPE IF EXISTS location_state_type;")
    op.create_index(op.f("ix_locations_id"), "locations", ["id"], unique=True)
    op.create_index(op.f("ix_storages_id"), "storages", ["id"], unique=True)
    op.create_index(op.f("ix_libraries_id"), "libraries", ["id"], unique=True)


def upgrade_roles() -> None:
    op.add_column("roles", sa.Column("actions", sa.JSON(), nullable=True))
    op.alter_column(
        "roles", "name", existing_type=sa.VARCHAR(), nullable=False
    )
    op.create_unique_constraint(None, "roles", ["name"])


def upgrade_users() -> None:
    op.add_column("users", sa.Column("settings", sa.JSON(), nullable=True))
    op.add_column(
        "users", sa.Column("department_id", sa.Integer(), nullable=True)
    )
    op.drop_index("ix_users_username", table_name="users")
    op.create_index(
        op.f("ix_users_username"), "users", ["username"], unique=True
    )
    op.create_foreign_key(
        None, "users", "departments", ["department_id"], ["id"]
    )


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.execute(
        """
        CREATE OR REPLACE FUNCTION int_array_to_jsonb(arr integer[])
        RETURNS jsonb AS $$
        BEGIN
            RETURN to_jsonb(arr);
        END;
        $$ LANGUAGE plpgsql;
    """
    )

    upgrade_digitization_lists()
    upgrade_catalog_records_and_documents_tables()
    upgrade_document_comments()
    upgrade_categories()
    upgrade_departments()
    upgrade_generated_extractions()
    upgrade_locations()
    upgrade_periodic_tasks()
    upgrade_tasks()
    upgrade_roles()
    upgrade_users()

    op.drop_index("ix_actions_role_id", table_name="actions")
    op.drop_table("actions")
    op.create_index(
        op.f("ix_intentions_id"), "intentions", ["id"], unique=False
    )
    op.alter_column(
        "task_documents",
        "deleted",
        existing_type=sa.BOOLEAN(),
        nullable=True,
        existing_server_default=sa.text("false"),
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(None, "users", type_="foreignkey")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.drop_column("users", "department_id")
    op.drop_column("users", "settings")
    op.drop_index(op.f("ix_tasks_task_type"), table_name="tasks")
    op.alter_column(
        "tasks",
        "task_state",
        existing_type=postgresql.ENUM(
            "Planned",
            "Running",
            "Finished",
            "Failed",
            "Killed",
            name="taskstate",
        ),
        nullable=True,
        existing_server_default=sa.text("'Planned'::taskstate"),
    )
    op.alter_column(
        "tasks",
        "query",
        existing_type=sa.JSON(),
        type_=sa.VARCHAR(),
        existing_nullable=True,
    )
    op.alter_column(
        "tasks", "owner", existing_type=sa.VARCHAR(), nullable=True
    )
    op.alter_column(
        "tasks",
        "task_type",
        existing_type=postgresql.ENUM(
            "PredictVolumePages",
            "SyncFromCatalog",
            "SyncFromDigitizationRegistry",
            "GenerateVolumesPagesDataset",
            "GenerateItemsPagesDataset",
            name="tasktype",
        ),
        nullable=True,
    )
    op.alter_column(
        "task_documents",
        "deleted",
        existing_type=sa.BOOLEAN(),
        nullable=False,
        existing_server_default=sa.text("false"),
    )
    op.drop_index(op.f("ix_storages_id"), table_name="storages")
    op.drop_constraint(None, "roles", type_="unique")
    op.alter_column("roles", "name", existing_type=sa.VARCHAR(), nullable=True)
    op.drop_column("roles", "actions")
    op.drop_index(op.f("ix_locations_id"), table_name="locations")
    op.alter_column(
        "locations",
        "state",
        existing_type=sa.Enum("Active", "Closed", name="locationstate"),
        type_=postgresql.ENUM("Active", "Closed", name="location_state_type"),
        existing_nullable=False,
    )
    op.drop_index(op.f("ix_libraries_id"), table_name="libraries")
    op.drop_index(op.f("ix_intentions_id"), table_name="intentions")
    op.drop_index(
        op.f("ix_generated_extractions_id"), table_name="generated_extractions"
    )
    op.drop_index(
        op.f("ix_generated_extractions_generated_by"),
        table_name="generated_extractions",
    )
    op.alter_column(
        "generated_extractions",
        "location_ids",
        existing_type=sa.JSON(),
        type_=postgresql.ARRAY(sa.INTEGER()),
        existing_nullable=True,
        existing_server_default=sa.text("'{}'::integer[]"),
    )
    op.alter_column(
        "generated_extractions",
        "include_categories",
        existing_type=sa.JSON(),
        type_=postgresql.ARRAY(sa.INTEGER()),
        existing_nullable=True,
    )
    op.alter_column(
        "generated_extractions",
        "document_ids",
        existing_type=sa.JSON(),
        type_=postgresql.ARRAY(sa.INTEGER()),
        existing_nullable=True,
        using="document_ids::json",
    )
    op.add_column(
        "documents",
        sa.Column(
            "material_type",
            postgresql.ENUM(
                "Book",
                "ContinuingResource",
                "Map",
                "Music",
                "Other",
                name="materialtype",
            ),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.add_column(
        "documents",
        sa.Column(
            "isbn_issn", sa.VARCHAR(), autoincrement=False, nullable=True
        ),
    )
    op.add_column(
        "documents",
        sa.Column(
            "alternative_ids",
            postgresql.ARRAY(sa.VARCHAR()),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.add_column(
        "documents",
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(),
            server_default=sa.text("now()"),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.add_column(
        "documents",
        sa.Column(
            "extraction_id", sa.INTEGER(), autoincrement=False, nullable=True
        ),
    )
    op.add_column(
        "documents",
        sa.Column(
            "languages",
            postgresql.ARRAY(sa.VARCHAR()),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.add_column(
        "documents",
        sa.Column(
            "publisher", sa.VARCHAR(), autoincrement=False, nullable=True
        ),
    )
    op.add_column(
        "documents",
        sa.Column(
            "locationUri", sa.VARCHAR(), autoincrement=False, nullable=True
        ),
    )
    op.add_column(
        "documents",
        sa.Column(
            "signature", sa.VARCHAR(), autoincrement=False, nullable=True
        ),
    )
    op.add_column(
        "documents",
        sa.Column("title", sa.VARCHAR(), autoincrement=False, nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column(
            "publishing_year", sa.VARCHAR(), autoincrement=False, nullable=True
        ),
    )
    op.add_column(
        "documents",
        sa.Column(
            "frequencies",
            postgresql.JSON(astext_type=sa.Text()),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.add_column(
        "documents",
        sa.Column("year", sa.VARCHAR(), autoincrement=False, nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column(
            "publishing_place",
            sa.VARCHAR(),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.add_column(
        "documents",
        sa.Column("creator", sa.VARCHAR(), autoincrement=False, nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("cnb", sa.VARCHAR(), autoincrement=False, nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("size", sa.VARCHAR(), autoincrement=False, nullable=True),
    )
    op.drop_constraint(None, "documents", type_="foreignkey")
    op.drop_constraint(None, "documents", type_="foreignkey")
    op.create_foreign_key(
        "documents_extraction_id_fkey",
        "documents",
        "digitization_extractions",
        ["extraction_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.drop_constraint(None, "documents", type_="unique")
    op.drop_index(
        op.f("ix_documents_digitization_list_id"), table_name="documents"
    )
    op.drop_index(op.f("ix_documents_added_by"), table_name="documents")
    op.create_index(
        "ix_documents_extraction_id",
        "documents",
        ["extraction_id"],
        unique=False,
    )
    op.create_index(
        "ix_documents_creator", "documents", ["creator"], unique=False
    )
    op.create_unique_constraint(
        "documents_sysno_volume_barcode_key",
        "documents",
        ["sysno", "volume", "barcode"],
    )
    op.alter_column(
        "documents",
        "extraction_priority",
        existing_type=sa.INTEGER(),
        comment="Priority of extraction (1-5)",
        existing_nullable=False,
        existing_server_default=sa.text("3"),
    )
    op.alter_column(
        "documents",
        "digitization_state",
        existing_type=postgresql.ENUM(
            "Finished",
            "InProgress",
            "Planned",
            "NotDigitized",
            name="digitizationstate",
        ),
        nullable=True,
    )
    op.alter_column(
        "documents", "sysno", existing_type=sa.VARCHAR(), nullable=False
    )
    op.drop_column("documents", "digitization_list_id")
    op.drop_column("documents", "digitization_registry_id")
    op.drop_column("documents", "added_by")
    op.drop_column("documents", "added_at")
    op.drop_column("documents", "document_signature")
    op.drop_column("documents", "volume_year")
    op.add_column(
        "departments",
        sa.Column(
            "users",
            postgresql.ARRAY(sa.VARCHAR()),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.alter_column(
        "departments", "name", existing_type=sa.VARCHAR(), nullable=True
    )
    op.alter_column(
        "departments",
        "abbreviation",
        existing_type=sa.VARCHAR(),
        nullable=True,
    )
    op.drop_constraint(None, "comments", type_="foreignkey")
    op.create_foreign_key(
        "comments_document_id_fkey",
        "comments",
        "documents",
        ["document_id"],
        ["id"],
    )
    op.alter_column(
        "categories", "assignable", existing_type=sa.BOOLEAN(), nullable=True
    )
    op.alter_column(
        "categories", "level", existing_type=sa.INTEGER(), nullable=True
    )
    op.alter_column(
        "categories", "name", existing_type=sa.VARCHAR(), nullable=True
    )
    op.create_table(
        "categories_quotas",
        sa.Column(
            "id",
            sa.INTEGER(),
            server_default=sa.text(
                "nextval('categories_quotas_id_seq'::regclass)"
            ),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column("name", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column(
            "description", sa.VARCHAR(), autoincrement=False, nullable=True
        ),
        sa.Column(
            "pages_count", sa.INTEGER(), autoincrement=False, nullable=True
        ),
        sa.Column("active", sa.BOOLEAN(), autoincrement=False, nullable=True),
        sa.PrimaryKeyConstraint("id", name="categories_quotas_pkey"),
        sa.UniqueConstraint("name", name="categories_quotas_name_key"),
        postgresql_ignore_search_path=False,
    )
    op.create_index(
        "ix_categories_quotas_id", "categories_quotas", ["id"], unique=False
    )
    op.create_table(
        "digitization_extractions",
        sa.Column("id", sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column(
            "document_ids",
            postgresql.ARRAY(sa.INTEGER()),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column(
            "extracted_pages", sa.INTEGER(), autoincrement=False, nullable=True
        ),
        sa.Column(
            "intention_id", sa.INTEGER(), autoincrement=False, nullable=True
        ),
        sa.Column(
            "extractor", sa.VARCHAR(), autoincrement=False, nullable=True
        ),
        sa.Column(
            "extracted_at",
            postgresql.TIMESTAMP(),
            server_default=sa.text("now()"),
            autoincrement=False,
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["intention_id"],
            ["categories_quotas.id"],
            name="digitization_extractions_intention_id_fkey",
        ),
        sa.PrimaryKeyConstraint("id", name="digitization_extractions_pkey"),
    )
    op.create_table(
        "actions",
        sa.Column(
            "role_id", sa.INTEGER(), autoincrement=False, nullable=False
        ),
        sa.Column(
            "action",
            postgresql.ENUM(
                "ReadDatatableOwn",
                "ReadDatatableDepartment",
                "ReadDatatableAll",
                "InsertDatatable",
                "EditDatatableOwn",
                "EditDatatableDepartment",
                "EditDatatableAll",
                "WriteDatatable",
                "CommentOnDatatable",
                "ReadCategoriesAll",
                "ReadCategoriesDepartment",
                "EditCategoriesAll",
                "EditCategoriesDepartment",
                "PlanTasks",
                "AdminTasks",
                "EditAccess",
                "Extract",
                "AdminExtractions",
                "AdminDatabase",
                name="actiontype",
            ),
            autoincrement=False,
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["role_id"], ["roles.id"], name="actions_role_id_fkey"
        ),
    )
    op.create_index("ix_actions_role_id", "actions", ["role_id"], unique=False)
    op.create_table(
        "celery_tasks",
        sa.Column("id", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column(
            "task_id",
            sa.VARCHAR(length=155),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column(
            "status", sa.VARCHAR(length=50), autoincrement=False, nullable=True
        ),
        sa.Column(
            "result", postgresql.BYTEA(), autoincrement=False, nullable=True
        ),
        sa.Column(
            "date_done",
            postgresql.TIMESTAMP(),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column("traceback", sa.TEXT(), autoincrement=False, nullable=True),
        sa.Column(
            "name", sa.VARCHAR(length=155), autoincrement=False, nullable=True
        ),
        sa.Column(
            "args", postgresql.BYTEA(), autoincrement=False, nullable=True
        ),
        sa.Column(
            "kwargs", postgresql.BYTEA(), autoincrement=False, nullable=True
        ),
        sa.Column(
            "worker",
            sa.VARCHAR(length=155),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column("retries", sa.INTEGER(), autoincrement=False, nullable=True),
        sa.Column(
            "queue", sa.VARCHAR(length=155), autoincrement=False, nullable=True
        ),
        sa.PrimaryKeyConstraint("id", name="celery_tasks_pkey"),
        sa.UniqueConstraint("task_id", name="celery_tasks_task_id_key"),
    )
    op.create_table(
        "celery_groups",
        sa.Column("id", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column(
            "taskset_id",
            sa.VARCHAR(length=155),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column(
            "result", postgresql.BYTEA(), autoincrement=False, nullable=True
        ),
        sa.Column(
            "date_done",
            postgresql.TIMESTAMP(),
            autoincrement=False,
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id", name="celery_groups_pkey"),
        sa.UniqueConstraint("taskset_id", name="celery_groups_taskset_id_key"),
    )
    op.drop_index(
        op.f("ix_catalog_record_subfield_differences_field_difference_id"),
        table_name="catalog_record_subfield_differences",
    )
    op.drop_index(
        op.f("ix_catalog_record_subfield_differences_code"),
        table_name="catalog_record_subfield_differences",
    )
    op.drop_table("catalog_record_subfield_differences")
    op.drop_index(
        op.f("ix_digitization_lists_id"), table_name="digitization_lists"
    )
    op.drop_index(
        op.f("ix_digitization_lists_created_by"),
        table_name="digitization_lists",
    )
    op.drop_table("digitization_lists")
    op.drop_index(
        op.f("ix_catalog_record_field_differences_tag"),
        table_name="catalog_record_field_differences",
    )
    op.drop_index(
        op.f("ix_catalog_record_field_differences_sysno"),
        table_name="catalog_record_field_differences",
    )
    op.drop_index(
        op.f("ix_catalog_record_field_differences_source"),
        table_name="catalog_record_field_differences",
    )
    op.drop_index(
        op.f("ix_catalog_record_field_differences_indicator2"),
        table_name="catalog_record_field_differences",
    )
    op.drop_index(
        op.f("ix_catalog_record_field_differences_indicator1"),
        table_name="catalog_record_field_differences",
    )
    op.drop_table("catalog_record_field_differences")
    op.drop_table("catalog_record_barcode")
    op.drop_index(op.f("ix_periodic_tasks_id"), table_name="periodic_tasks")
    op.drop_table("periodic_tasks")
    op.drop_index(
        op.f("ix_catalog_records_sysno"), table_name="catalog_records"
    )
    op.drop_table("catalog_records")
    # ### end Alembic commands ###
