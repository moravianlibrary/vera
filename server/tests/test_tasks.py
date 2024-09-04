from tests.test_database_base import TestDatabaseBase
from unittest.mock import patch, Mock, MagicMock
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
from services.predictor import PREDICT_PERIODICAL_PAGE_COUNT_KEYWORD


TEST_MARC_BYTES = b"00048    a2200037   4500001001000000\x1e000121929\x1e\x1d"


class TestTasksBase(TestDatabaseBase):
    def setUp(self):
        super().setUp()

        with open("tests/aleph_records/MZK01-000165329.marc", "rb") as f:
            self.session.add_all(
                [
                    Category(
                        name="Test Category",
                    ),
                    CatalogRecord(
                        sysno="MZK01-000165329",
                        marc=f.read(),
                    ),
                    Task(
                        task_type=TaskType.SyncFromCatalogs,
                        owner="Test User",
                    ),
                ]
            )
            self.session.flush()
            self.session.add(
                Document(
                    sysno="MZK01-000165329",
                    barcode="2619868037",
                    volume="39",
                    volume_year="1939",
                    added_by="Test User",
                    category_id=1,
                )
            )
            self.session.flush()
            self.session.add(
                TaskDocument(
                    task_id=1,
                    document_id=1,
                )
            )
            self.session.flush()


class TestCatalogSyncIntegration(TestTasksBase):
    @patch("services.documents_indexer.DocumentsIndexer.get_instance")
    def test_catalog_sync(self, mock_get_instance: Mock):
        # Arrange
        mock_get_instance.return_value = MagicMock()

        # Act
        SyncFromCatalogs(self.session, 1)
        document = Document.get(self.session, 1)

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

    @patch("services.external.aleph.AlephClient.get_record")
    @patch("services.documents_indexer.DocumentsIndexer.get_instance")
    def test_catalog_sync_with_invalid_sysno(
        self, mock_get_instance: Mock, mock_get_record: Mock
    ):
        # Arrange
        mock_get_instance.return_value = MagicMock()
        mock_get_record.return_value = None, AlephResponseStatus.InvalidSysno

        # Act
        SyncFromCatalogs(self.session, 1)
        document = Document.get(self.session, 1)

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
        self.session.close()


class TestDigitizationRegistrySyncIntegration(TestTasksBase):
    @patch("services.documents_indexer.DocumentsIndexer.get_instance")
    def test_registry_sync(self, mock_get_instance: Mock):
        # Arrange
        mock_get_instance.return_value = MagicMock()

        # Act
        registry_id_before_sync = Document.get(
            self.session, 1
        ).digitization_registry_id
        state_before_sync = Document.get(self.session, 1).digitization_state
        SyncFromDigitizationRegistry(self.session, 1)
        registry_id_after_sync = Document.get(
            self.session, 1
        ).digitization_registry_id
        state_after_sync = Document.get(self.session, 1).digitization_state
        self.session.close()

        # Assert
        self.assertIsNone(registry_id_before_sync)
        self.assertEqual(state_before_sync, DigitizationState.NotDigitized)
        self.assertEqual(registry_id_after_sync, 306978)
        self.assertEqual(state_after_sync, DigitizationState.Finished)

    @patch(
        "services.external.digitization_registry"
        ".DigitizationRegistryClient.get_record"
    )
    @patch("services.documents_indexer.DocumentsIndexer.get_instance")
    def test_registry_sync_with_not_found_record(
        self, mock_get_instance: Mock, mock_get_record: Mock
    ):
        # Arrange
        mock_get_instance.return_value = MagicMock()
        mock_get_record.return_value = None

        # Act
        SyncFromDigitizationRegistry(self.session, 1)
        registry_id_after_sync = Document.get(
            self.session, 1
        ).digitization_registry_id
        state_after_sync = Document.get(self.session, 1).digitization_state
        self.session.close()

        # Assert
        self.assertIsNone(registry_id_after_sync)
        self.assertEqual(state_after_sync, DigitizationState.NotDigitized)


class TestReindexIntegration(TestTasksBase):
    @patch("services.documents_indexer.DocumentsIndexer.get_instance")
    def test_reindex(self, mock_get_instance: Mock):
        # Arrange
        mock_indexer = MagicMock()
        mock_get_instance.return_value = mock_indexer

        # Act
        Reindex(self.session, 1)

        # Assert
        mock_indexer.index.assert_called_once_with(
            Document.get(self.session, 1)
        )


class TestPredictPeriodicalPageCountIntegration(TestTasksBase):
    @patch("services.predictor.requests.get")
    @patch("services.documents_indexer.DocumentsIndexer.get_instance")
    def test_predict_periodical_page_count(
        self, mock_get_instance: Mock, mock_get: Mock
    ):
        # Arrange
        mock_get_instance.return_value = MagicMock()

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            PREDICT_PERIODICAL_PAGE_COUNT_KEYWORD: 100
        }
        mock_get.return_value = mock_response

        # Act
        PredictPeriodicalPageCount(self.session, 1)
        document = Document.get(self.session, 1)

        # Assert
        self.assertEqual(document.pages_count_predicted, 100)
        self.session.close()

    @patch("services.predictor.requests.get")
    @patch("services.documents_indexer.DocumentsIndexer.get_instance")
    def test_predict_periodical_page_count_failure(
        self, mock_get_instance: Mock, mock_get: Mock
    ):
        # Arrange
        mock_get_instance.return_value = MagicMock()

        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.json.return_value = {"error": "Internal Server Error"}
        mock_get.return_value = mock_response

        # Act
        PredictPeriodicalPageCount(self.session, 1)
        document = Document.get(self.session, 1)

        # Assert
        self.assertIsNone(document.pages_count_predicted)
        self.assertEqual(
            TaskDocument.find(self.session, 1, 1).error_type.value,
            "UnknownError",
        )
        self.assertEqual(
            TaskDocument.find(self.session, 1, 1).error_message,
            "Failed to predict page count",
        )
        self.session.close()
