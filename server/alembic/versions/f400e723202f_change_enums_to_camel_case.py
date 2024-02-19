"""change enums to camel case

Revision ID: f400e723202f
Revises: 8ae46be17e1c
Create Date: 2024-02-16 17:39:09.401307

"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "f400e723202f"
down_revision = "8ae46be17e1c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        # Update digitization_state type
        op.execute(
            """
            CREATE TYPE new_digitization_state AS ENUM (
                'Finished',
                'InProgress',
                'Planned',
                'NotDigitized'
            );
        """
        )

        op.execute(
            """
            ALTER TABLE documents
            ADD COLUMN new_digitization_state_column new_digitization_state;
        """
        )

        op.execute(
            """
            UPDATE documents
            SET new_digitization_state_column = CASE
                WHEN digitization_state = 'FINISHED'
                    THEN 'Finished'::new_digitization_state
                WHEN digitization_state = 'IN_PROGRESS'
                    THEN 'InProgress'::new_digitization_state
                WHEN digitization_state = 'PLANNED'
                    THEN 'Planned'::new_digitization_state
                WHEN digitization_state = 'NOT_DIGITIZED'
                    THEN 'NotDigitized'::new_digitization_state
            END;
        """
        )

        op.execute("ALTER TABLE documents DROP COLUMN digitization_state;")

        op.execute(
            """
            ALTER TABLE documents RENAME COLUMN
            new_digitization_state_column TO digitization_state;
            """
        )

        op.execute("DROP TYPE IF EXISTS digitizationstate;")

        op.execute(
            "ALTER TYPE new_digitization_state RENAME TO digitizationstate;"
        )

        # Update material type
        op.execute(
            """
            CREATE TYPE new_material_type AS ENUM (
                'Book',
                'ContinuingResource',
                'Map',
                'Music',
                'Other'
            );
        """
        )

        op.execute(
            """
            ALTER TABLE documents
            ADD COLUMN new_material_type_column new_material_type;
        """
        )

        op.execute(
            """
            UPDATE documents
            SET new_material_type_column = CASE
                WHEN material_type = 'book'
                    THEN 'Book'::new_material_type
                WHEN material_type = 'continuing_resource'
                    THEN 'ContinuingResource'::new_material_type
                WHEN material_type = 'map'
                    THEN 'Map'::new_material_type
                WHEN material_type = 'music'
                    THEN 'Music'::new_material_type
                WHEN material_type = 'other'
                    THEN 'Other'::new_material_type
            END;
        """
        )

        op.execute("ALTER TABLE documents DROP COLUMN material_type;")

        op.execute(
            """
            ALTER TABLE documents RENAME COLUMN
            new_material_type_column TO material_type;
            """
        )

        op.execute("DROP TYPE IF EXISTS materialtype;")

        op.execute("ALTER TYPE new_material_type RENAME TO materialtype;")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        # Update digitization_state type
        op.execute(
            """
            CREATE TYPE new_digitization_state AS ENUM (
                'FINISHED',
                'IN_PROGRESS',
                'PLANNED',
                'NOT_DIGITIZED'
            );
        """
        )

        op.execute(
            """
            ALTER TABLE documents
            ADD COLUMN new_digitization_state_column new_digitization_state;
        """
        )

        op.execute(
            """
            UPDATE documents
            SET new_digitization_state_column = CASE
                WHEN digitization_state = 'Finished'
                    THEN 'FINISHED'::new_digitization_state
                WHEN digitization_state = 'InProgress'
                    THEN 'IN_PROGRESS'::new_digitization_state
                WHEN digitization_state = 'Planned'
                    THEN 'PLANNED'::new_digitization_state
                WHEN digitization_state = 'NotDigitized'
                    THEN 'NOT_DIGITIZED'::new_digitization_state
            END;
        """
        )

        op.execute("ALTER TABLE documents DROP COLUMN digitization_state;")

        op.execute(
            """
            ALTER TABLE documents RENAME COLUMN
            new_digitization_state_column TO digitization_state;
            """
        )

        op.execute("DROP TYPE IF EXISTS digitizationstate;")

        op.execute(
            "ALTER TYPE new_digitization_state RENAME TO digitizationstate;"
        )

        # Update material type
        op.execute(
            """
            CREATE TYPE new_material_type AS ENUM (
                'book',
                'continuing_resource',
                'map',
                'music',
                'other'
            );
        """
        )

        op.execute(
            """
            ALTER TABLE documents
            ADD COLUMN new_material_type_column new_material_type;
        """
        )

        op.execute(
            """
            UPDATE documents
            SET new_material_type_column = CASE
                WHEN 'Book' THEN 'book'::new_material_type
                WHEN 'ContinuingResource'
                    THEN 'continuing resource'::new_material_type
                WHEN 'Map' THEN 'map'::new_material_type
                WHEN 'Music' THEN 'music'::new_material_type
                WHEN 'Other' THEN 'other'::new_material_type
            END;
        """
        )

        op.execute("ALTER TABLE documents DROP COLUMN material_type;")

        op.execute(
            """
            ALTER TABLE documents RENAME COLUMN
            new_material_type_column TO material_type;
            """
        )

        op.execute("DROP TYPE IF EXISTS material_type;")

        op.execute("ALTER TYPE new_material_type RENAME TO material_type;")
