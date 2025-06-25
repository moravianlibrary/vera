from typing import List
from unittest import TestCase
from unittest.mock import MagicMock, patch

from adapters.indexer import get_es_session
from vera import app


class TestMockIndexer(TestCase):
    def getMockEsSession(self):
        return MagicMock()

    def getMockIndexerWithGetDocumentIds(self, document_ids: List[int]):
        mock_indexer = self.getMockEsSession()
        mock_indexer.get_document_ids.return_value = document_ids
        return mock_indexer

    def mockIndexer(self):
        app.dependency_overrides[get_es_session] = (
            lambda: self.getMockEsSession()
        )

    # TODO: replace with new mocking type
    def mockIndexerGetDocumentIds(self, document_ids: List[int]):
        self.mockIndexer()
        with patch(
            "schemas.base_es_model.BaseEsModel.search_source_ids"
        ) as mock_search_source_ids:
            mock_search_source_ids.return_value = document_ids
