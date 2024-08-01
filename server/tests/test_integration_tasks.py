from tests.test_integration import TestIntegration
from unittest.mock import patch, Mock
from helper_funcs import mock_db, get_test_db
from datatypes import TaskType
from tasks import (
    SyncFromCatalogs,
    SyncFromDigitizationRegistry,
    Reindex,
    PredictPeriodicalPageCount,
)
from services.external.aleph import AlephResponseStatus
from services.external.digitization_registry import DigitizationState
from datatypes import TaskDocumentErrorType
from models import CatalogRecord, Document, Task, TaskDocument, Category
from services.external.aleph import AlephRecord
from services.documents_indexer import DocumentsIndexer
from elasticsearch import NotFoundError
from services.predictor import PREDICT_PERIODICAL_PAGE_COUNT_KEYWORD


class TestCatalogSyncIntegration(TestIntegration):
    def get_testing_models(self):
        with open("tests/aleph_records/MZK01-000165329.marc", "rb") as f:
            return [
                Category(
                    name="Test Category",
                ),
                CatalogRecord(
                    sysno="MZK01-000165329",
                    marc=f.read(),
                ),
                Document(
                    id=1,
                    sysno="MZK01-000165329",
                    barcode="2619868037",
                    volume="39",
                    volume_year="1939",
                    added_by="Test User",
                    category_id=1,
                ),
                Task(
                    task_type=TaskType.SyncFromCatalogs,
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
        catalog_record = CatalogRecord.get(session, "MZK01-000165329")
        catalog_record.marc = None
        catalog_record.save(session)
        document = Document.get(session, 1)
        self.assertIsNone(document.catalog_record.marc)
        self.assertEqual(document.digitization_registry_id, None)

        # Act
        SyncFromCatalogs(session, 1)
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

    @patch("services.external.aleph.AlephClient.get_record")
    def test_catalog_sync_with_invalid_sysno(self, mock_get_record: Mock):
        # Arrange
        mock_db(self.get_testing_models())
        session = get_test_db()
        mock_get_record.return_value = None, AlephResponseStatus.InvalidSysno
        catalog_record = CatalogRecord.get(session, "MZK01-000165329")
        catalog_record.marc = None
        catalog_record.save(session)

        # Act
        SyncFromCatalogs(session, 1)
        document = Document.get(session, 1)

        # Assert
        self.assertEqual(
            document.task_documents[0].error_type,
            TaskDocumentErrorType.UnknownError,
        )
        self.assertEqual(
            document.task_documents[0].error_message,
            "Record with sysno MZK01-000165329 is not available from Aleph. "
            "Status: AlephResponseStatus.InvalidSysno.",
        )
        self.assertIsNone(document.catalog_record.main_record)
        session.close()


class TestDigitizationRegistrySyncIntegration(TestIntegration):
    def get_testing_models(self):
        with open("tests/aleph_records/MZK01-000165329.marc", "rb") as f:
            return [
                Category(
                    name="Test Category",
                ),
                CatalogRecord(
                    sysno="MZK01-000165329",
                    marc=f.read(),
                ),
                Document(
                    id=1,
                    sysno="MZK01-000165329",
                    barcode="2619868037",
                    volume="39",
                    volume_year="1939",
                    added_by="Test User",
                    category_id=1,
                ),
                Task(
                    task_type=TaskType.SyncFromCatalogs,
                    owner="Test User",
                ),
                TaskDocument(
                    task_id=1,
                    document_id=1,
                ),
            ]

    def test_registry_sync(self):
        # Arrange
        mock_db(self.get_testing_models())
        session = get_test_db()

        # Act
        registry_id_before_sync = Document.get(
            session, 1
        ).digitization_registry_id
        state_before_sync = Document.get(session, 1).digitization_state
        SyncFromDigitizationRegistry(session, 1)
        registry_id_after_sync = Document.get(
            session, 1
        ).digitization_registry_id
        state_after_sync = Document.get(session, 1).digitization_state
        session.close()

        # Assert
        self.assertIsNone(registry_id_before_sync)
        self.assertIsNone(state_before_sync)
        self.assertEqual(registry_id_after_sync, 306978)
        self.assertEqual(state_after_sync, DigitizationState.Finished)

    @patch(
        "services.external.digitization_registry"
        ".DigitizationRegistryClient.get_record"
    )
    def test_registry_sync_with_not_found_record(self, mock_get_record: Mock):
        # Arrange
        mock_db(self.get_testing_models())
        session = get_test_db()
        document = Document.get(session, 1)
        document.digitization_registry_id = 306978
        document.digitization_state = DigitizationState.Finished
        document.save(session)
        mock_get_record.return_value = None

        # Act
        SyncFromDigitizationRegistry(session, 1)
        registry_id_after_sync = Document.get(
            session, 1
        ).digitization_registry_id
        state_after_sync = Document.get(session, 1).digitization_state
        session.close()

        # Assert
        self.assertIsNone(registry_id_after_sync)
        self.assertEqual(state_after_sync, DigitizationState.NotDigitized)


class TestReindexIntegration(TestIntegration):
    def get_testing_models(self):
        with open("tests/aleph_records/MZK01-000165329.marc", "rb") as f:
            return [
                Category(
                    name="Test Category",
                ),
                CatalogRecord(
                    sysno="MZK01-000165329",
                    marc=f.read(),
                ),
                Document(
                    id=1,
                    sysno="MZK01-000165329",
                    barcode="2619868037",
                    volume="39",
                    volume_year="1939",
                    added_by="Test User",
                    category_id=1,
                ),
                Task(
                    task_type=TaskType.SyncFromCatalogs,
                    owner="Test User",
                ),
                TaskDocument(
                    task_id=1,
                    document_id=1,
                ),
            ]

    def test_reindex(self):
        # Arrange
        mock_db(self.get_testing_models())
        session = get_test_db()
        indexer = DocumentsIndexer.get_instance()
        indexer.recreate_index()

        # Act
        with self.assertRaises(NotFoundError):
            indexer.get(1)
        Reindex(session, 1)
        document = indexer.get(1)
        indexer.close()
        session.close()

        # Assert
        self.assertEqual(document["sysno"], "MZK01-000165329")


class TestPredictPeriodicalPageCountIntegration(TestIntegration):
    def get_testing_models(self):
        with open("tests/aleph_records/MZK01-000165329.marc", "rb") as f:
            return [
                Category(
                    name="Test Category",
                ),
                CatalogRecord(
                    sysno="MZK01-000165329",
                    marc=f.read(),
                ),
                Document(
                    id=1,
                    sysno="MZK01-000165329",
                    barcode="2619868037",
                    volume="39",
                    volume_year="1939",
                    added_by="Test User",
                    category_id=1,
                ),
                Task(
                    task_type=TaskType.SyncFromCatalogs,
                    owner="Test User",
                ),
                TaskDocument(
                    task_id=1,
                    document_id=1,
                ),
            ]

    @patch("services.predictor.requests.get")
    def test_predict_periodical_page_count(self, mock_get):
        # Arrange
        mock_db(self.get_testing_models())
        session = get_test_db()

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            PREDICT_PERIODICAL_PAGE_COUNT_KEYWORD: 100
        }
        mock_get.return_value = mock_response

        # Act
        PredictPeriodicalPageCount(session, 1)
        document = Document.get(session, 1)

        # Assert
        self.assertEqual(document.pages_count_predicted, 100)
        session.close()

    @patch("services.predictor.requests.get")
    def test_predict_periodical_page_count_failure(self, mock_get):
        # Arrange
        mock_db(self.get_testing_models())
        session = get_test_db()

        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.json.return_value = {"error": "Internal Server Error"}
        mock_get.return_value = mock_response

        # Act
        PredictPeriodicalPageCount(session, 1)
        document = Document.get(session, 1)

        # Assert
        self.assertIsNone(document.pages_count_predicted)
        self.assertEqual(
            TaskDocument.find(session, 1, 1).error_type.value,
            "UnknownError",
        )
        self.assertEqual(
            TaskDocument.find(session, 1, 1).error_message,
            "Failed to predict page count",
        )
        session.close()
