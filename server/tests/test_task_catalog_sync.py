from tests.test_routines import TestRoutines

from catalogs.enums import DigitizationState
from documents.crud import create_document, get_document
from documents.schemas import DocumentCreate
from tasks.crud import create_query_task
from tasks.types import TaskType
from tasks.routines import sync_from_digitization_registry, sync_from_catalog
from tasks.schemas import TaskCreate


class TestCatalogSync(TestRoutines):
    def test_catalog_sync(self):
        # Arrange
        document = DocumentCreate(
            sysno="MZK01-000165329",
            volume="39",
            barcode="2619868037",
            title="Test Document",
        )
        task = TaskCreate(task_type=TaskType.SyncFromCatalog)

        # Act
        document_id = create_document(document, "Test User", self.db).id
        document_before_sync = get_document(document_id, self.db)
        title_before_sync = document_before_sync.title
        state_before_sync = document_before_sync.digitization_state
        task_id = create_query_task(
            task, [document_id], "Test User", f"id={document_id}", self.db
        ).id
        sync_from_catalog(task_id, "Test User", self.db)
        document_after_sync = get_document(document_id, self.db)

        self.assertEqual(title_before_sync, "Test Document")
        self.assertEqual(state_before_sync, None)
        self.assertEqual(
            document_after_sync.title,
            "Lidé a země : zeměpisný a cestopisný měsíčník",
        )
        self.assertEqual(document_after_sync.digitization_state, None)

    def test_registry_sync(self):
        # Arrange
        document = DocumentCreate(
            sysno="MZK01-000165329",
            volume="39",
            barcode="2619868037",
            title="Test Document",
            digitization_state=DigitizationState.InProgress,
        )
        task = TaskCreate(task_type=TaskType.SyncFromDigitizationRegistry)

        # Act
        document_id = create_document(document, "Test User", self.db).id
        state_before_sync = get_document(
            document_id, self.db
        ).digitization_state
        task_id = create_query_task(
            task, [document_id], "Test User", f"id={document_id}", self.db
        ).id
        sync_from_digitization_registry(task_id, "Test User", self.db)
        document_after_sync = get_document(document_id, self.db)

        # Assert
        self.assertEqual(state_before_sync, document.digitization_state)
        self.assertEqual(
            document_after_sync.digitization_state, DigitizationState.Finished
        )
