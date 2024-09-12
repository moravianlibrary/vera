from unittest import TestCase
from unittest.mock import MagicMock
from vera import app
from routers.utils.dependencies import get_documents_indexer
from typing import List


class TestMockIndexer(TestCase):
    def getMockIndexer(self):
        return MagicMock()

    def getMockIndexerWithGetDocumentIds(self, document_ids: List[int]):
        mock_indexer = self.getMockIndexer()
        mock_indexer.get_document_ids.return_value = document_ids
        return mock_indexer

    def mockIndexer(self):
        app.dependency_overrides[get_documents_indexer] = (
            lambda: self.getMockIndexer()
        )

    def mockIndexerGetDocumentIds(self, document_ids: List[int]):
        app.dependency_overrides[get_documents_indexer] = (
            lambda: self.getMockIndexerWithGetDocumentIds(document_ids)
        )
