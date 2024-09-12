from tests.test_base_database import TestBaseDatabase
from tests.test_mock_indexer import TestMockIndexer
from unittest.mock import patch, MagicMock, Mock
from tests.patch_resources import patch_aleph_client, MockAlephClient
from logic.add_document import add_document
from datatypes import (
    AlephResponseStatus,
    AddDocumentResponseStatus,
    IdentifierType,
)
from schemas import Identifier


class TestAddDocumentLogic(TestBaseDatabase, TestMockIndexer):
    def setUp(self):
        TestBaseDatabase.setUp(self)
        TestMockIndexer.setUp(self)

    @patch_aleph_client
    def test_response_status_not_found_when_sysno_not_found(
        self, mock_aleph_client: MockAlephClient
    ):
        # Arrange
        mock_aleph_client.set_find_sysno_response(
            None,
            AlephResponseStatus.RecordNotFound,
        )

        # Act
        response, status = add_document(
            self.session,
            self.getMockIndexer(),
            Identifier(
                identifier_type=IdentifierType.Sysno,
                value="123456789",
            ),
            "test_user",
            1,
        )

        # Assert
        self.assertEqual(status, AddDocumentResponseStatus.AlephRecordNotFound)
        self.assertIsNone(response)

    @patch_aleph_client
    @patch("logic.add_document.update_catalog_record")
    def test_response_status_not_found_when_catalog_record_not_found(
        self,
        mock_update_catalog_record: Mock,
        mock_aleph_client: MockAlephClient,
    ):
        # Arrange
        mock_aleph_client.set_find_sysno_response(
            "MZK01-123456789",
            AlephResponseStatus.Success,
        )
        mock_update_catalog_record.return_value = (
            None,
            AlephResponseStatus.RecordNotFound,
        )

        # Act
        response, status = add_document(
            self.session,
            self.getMockIndexer(),
            Identifier(
                identifier_type=IdentifierType.Sysno,
                value="123456789",
            ),
            "test_user",
            1,
        )

        # Assert
        self.assertEqual(status, AddDocumentResponseStatus.AlephRecordNotFound)
        self.assertIsNone(response)

    @patch_aleph_client
    @patch("logic.add_document.update_catalog_record")
    def test_create_new_document_when_catalog_record_with_one_issue(
        self,
        mock_update_catalog_record: Mock,
        mock_aleph_client: MockAlephClient,
    ):
        # Arrange
        mock_aleph_client.set_find_sysno_response(
            "MZK01-123456789",
            AlephResponseStatus.Success,
        )
        catalog_record = MagicMock()
        mock_update_catalog_record.return_value = (
            catalog_record,
            AlephResponseStatus.Success,
        )

        # Act
        response, status = add_document(
            self.session,
            self.getMockIndexer(),
            Identifier(
                identifier_type=IdentifierType.Sysno,
                value="123456789",
            ),
            "test_user",
            1,
        )

        # Assert
        self.assertEqual(status, AddDocumentResponseStatus.AlephRecordNotFound)
        self.assertIsNone(response)
