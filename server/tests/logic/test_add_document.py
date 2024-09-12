from tests.test_base_database import TestBaseDatabase
from unittest.mock import patch, MagicMock
from logic.add_document import add_document
from datatypes import AlephResponseStatus
from typing import Optional

from services.external.aleph import AlephClient


class TestAddDocumentLogic(TestBaseDatabase):
    def mockAlephClientFindSysno(
        self, sysno: Optional[str], status: AlephResponseStatus
    ):
        pass

    @patch("your_module.AlephClient")
    @patch("your_module.CatalogRecord")
    @patch("your_module.create_document")
    def test_catalog_record_not_found(
        self, mock_create_document, mock_catalog_record, mock_aleph_client
    ):
        # Arrange
        self.mockAlephClientFindSysno(None, AlephResponseStatus.RecordNotFound)
