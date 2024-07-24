from tests.test_integration import TestIntegration
from helper_funcs import mock_db, get_test_db
from datatypes import TaskType
from tasks.sync_from_catalog import sync_from_catalog
from tasks.sync_from_digitization_registry import (
    sync_from_digitization_registry,
)
from services.external.digitization_registry.types import DigitizationState
from models import CatalogRecord, Document, Task, TaskDocument, Category
from services.external.aleph.record import AlephRecord


class TestCatalogSync(TestIntegration):
    def get_testing_models(self):
        return [
            Category(
                name="Test Category",
            ),
            CatalogRecord(
                sysno="MZK01-000165329",
            ),
            Document(
                sysno="MZK01-000165329",
                barcode="2619868037",
                volume="39",
                added_by="Test User",
                category_id=1,
            ),
            Task(
                task_type=TaskType.SyncFromCatalog,
                owner="Test User",
            ),
            TaskDocument(
                task_id=1,
                document_id=1,
            ),
        ]

    def test_catalog_sync(self):
        # Arrange
        mock_db(self.get_testing_models())
        session = get_test_db()
        document = Document.get(session, 1)
        self.assertIsNone(document.catalog_record.marc)
        self.assertEqual(document.digitization_registry_id, None)

        # Act
        sync_from_catalog(1, "Test User", session)
        document = Document.get(session, 1)

        # Assert
        self.assertIsNotNone(document.catalog_record.marc)
        self.assertIsNotNone(document.catalog_record.main_record)
        self.assertEqual(
            AlephRecord(
                document.catalog_record.sysno,
                document.catalog_record.main_record,
            ).title,
            "Lidé a země : zeměpisný a cestopisný měsíčník",
        )
        self.assertEqual(document.digitization_state, None)
        session.close()

    def test_registry_sync(self):
        # Arrange
        mock_db(self.get_testing_models())
        session = get_test_db()

        # Act
        registry_id_before_sync = Document.get(
            session, 1
        ).digitization_registry_id
        state_before_sync = Document.get(session, 1).digitization_state
        sync_from_digitization_registry(1, "Test User", session)
        registry_id_after_sync = Document.get(
            session, 1
        ).digitization_registry_id
        state_after_sync = Document.get(session, 1).digitization_state
        session.close()

        # Assert
        self.assertEqual(registry_id_before_sync, None)
        self.assertEqual(state_before_sync, None)
        self.assertEqual(registry_id_after_sync, 306978)
        self.assertEqual(state_after_sync, DigitizationState.Finished)
