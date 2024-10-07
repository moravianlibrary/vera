from tests.test_base_database import TestBaseDatabase
from unittest.mock import patch, Mock, MagicMock
from datatypes import TaskType, TaskItemType
from tasks import (
    SyncDocumentsWithCatalogs,
    SyncDocumentsWithDigitizationRegistry,
    ReindexDocuments,
    PredictPeriodicalsPageCount,
)
from services.external.aleph import AlephResponseStatus
from services.external.digitization_registry import DigitizationState
from datatypes import TaskItemErrorType
from models import CatalogRecord, Document, Task, TaskItem, Category
from services.external.aleph import AlephRecord
from services.predictor import PREDICT_PERIODICAL_PAGE_COUNT_KEYWORD
from pymarc import MARCReader
from typing import Callable, Any
from functools import wraps


TEST_MARC_BYTES = b"00048    a2200037   4500001001000000\x1e000121929\x1e\x1d"


def mock_with_es_session(*args, **kwargs):
    def with_es_session(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            mock_es_session = MagicMock()
            return func(mock_es_session, *args, **kwargs)

        return wrapper

    return with_es_session


class TestTasksBase(TestBaseDatabase):
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
                        task_type=TaskType.SyncDocumentsWithCatalogs,
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
                TaskItem(
                    task_id=1, item_id="1", item_type=TaskItemType.Document
                )
            )
            self.session.flush()


class TestCatalogSyncIntegration(TestTasksBase):
    @patch("schemas.IndexDocument.save")
    def test_catalog_sync(self, mock_save: Mock):
        # Arrange
        mock_save.return_value = MagicMock()

        # Act
        SyncDocumentsWithCatalogs(self.session, 1)
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

    # TODO: move to specific class
    def getTestAlephRecord(self):
        reader = MARCReader(
            open("tests/aleph_records/MZK01-000165329.marc", "rb")
        )
        for record in reader:
            return AlephRecord("MZK01-000165329", record)

    @patch("services.external.aleph.AlephClient.get_record")
    @patch("schemas.IndexDocument.save")
    def test_catalog_sync_calls_aleph_once_per_sysno(
        self, mock_save: Mock, mock_get_record: Mock
    ):
        # Arrange
        mock_save.return_value = MagicMock()
        mock_get_record.return_value = (
            self.getTestAlephRecord(),
            AlephResponseStatus.Success,
        )

        self.session.add(
            Document(
                sysno="MZK01-000165329",
                barcode="2619700709",
                volume="40",
                volume_year="1940",
                added_by="Test User",
                category_id=1,
            )
        )
        self.session.flush()
        self.session.add(
            TaskItem(
                task_id=1,
                item_id="2",
                item_type=TaskItemType.Document,
            )
        )
        self.session.flush()

        # Act
        SyncDocumentsWithCatalogs(self.session, 1)
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
        mock_get_record.assert_called_once()

    @patch("services.external.aleph.AlephClient.get_record")
    @patch("schemas.IndexDocument.save")
    def test_catalog_sync_with_invalid_sysno(
        self,
        mock_save: Mock,
        mock_get_record: Mock,
    ):
        # Arrange
        mock_save.return_value = MagicMock()
        mock_get_record.return_value = None, AlephResponseStatus.InvalidSysno

        # Act
        SyncDocumentsWithCatalogs(self.session, 1)
        task_item = TaskItem.find(self.session, 1, 1)

        # Assert
        self.assertEqual(
            task_item.error_type,
            TaskItemErrorType.UnknownError,
        )
        self.assertEqual(
            task_item.error_message,
            "Record with sysno MZK01-000165329 is not available from Aleph. "
            "Status: AlephResponseStatus.InvalidSysno.",
        )


class TestDigitizationRegistrySyncIntegration(TestTasksBase):
    @patch("schemas.IndexDocument.save")
    def test_registry_sync(self, mock_save: Mock):
        # Arrange
        mock_save.return_value = MagicMock()

        # Act
        registry_id_before_sync = Document.get(
            self.session, 1
        ).digitization_registry_id
        state_before_sync = Document.get(self.session, 1).digitization_state
        SyncDocumentsWithDigitizationRegistry(self.session, 1)
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
    @patch("schemas.IndexDocument.save")
    def test_registry_sync_with_not_found_record(
        self, mock_save: Mock, mock_get_record: Mock
    ):
        # Arrange
        mock_save.return_value = MagicMock()
        mock_get_record.return_value = None

        # Act
        SyncDocumentsWithDigitizationRegistry(self.session, 1)
        registry_id_after_sync = Document.get(
            self.session, 1
        ).digitization_registry_id
        state_after_sync = Document.get(self.session, 1).digitization_state
        self.session.close()

        # Assert
        self.assertIsNone(registry_id_after_sync)
        self.assertEqual(state_after_sync, DigitizationState.NotDigitized)


class TestReindexIntegration(TestTasksBase):
    @patch("tasks.reindex_documents.IndexDocument")
    def test_reindex(self, mock_index_document: Mock):
        # Arrange
        mock_index_document.return_value = MagicMock()

        # Act
        ReindexDocuments(self.session, 1)

        # Assert
        # TODO: fix
        # mock_index_document.save.assert_called_once_with(
        #     Document.get(self.session, 1)
        # )


class TestPredictPeriodicalsPageCountIntegration(TestTasksBase):
    @patch("services.predictor.requests.get")
    @patch("schemas.IndexDocument.save")
    def test_predict_periodicals_page_count(
        self, mock_save: Mock, mock_get: Mock
    ):
        # Arrange
        mock_save.return_value = MagicMock()

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            PREDICT_PERIODICAL_PAGE_COUNT_KEYWORD: 100
        }
        mock_get.return_value = mock_response

        # Act
        PredictPeriodicalsPageCount(self.session, 1)
        document = Document.get(self.session, 1)

        # Assert
        self.assertEqual(document.pages_count_predicted, 100)

    @patch("services.predictor.requests.get")
    @patch("schemas.IndexDocument.save")
    def test_predict_periodicals_page_count_failure(
        self, mock_save: Mock, mock_get: Mock
    ):
        pass
        # # Arrange
        # mock_save.return_value = MagicMock()

        # mock_response = Mock()
        # mock_response.status_code = 500
        # mock_response.json.return_value = {"error": "Internal Server Error"}
        # mock_get.return_value = mock_response

        # # Act
        # PredictPeriodicalsPageCount(self.session, 1)
        # document = Document.get(self.session, 1)

        # # Assert
        # self.assertIsNone(document.pages_count_predicted)
        # self.assertEqual(
        #     TaskItem.find(self.session, 1, 1).error_type.value,
        #     "UnknownError",
        # )
        # self.assertEqual(
        #     TaskItem.find(self.session, 1, 1).error_message,
        #     "Failed to predict page count",
        # )
