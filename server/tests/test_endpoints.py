import unittest
from unittest.mock import MagicMock, Mock, patch
from helper_funcs import get_mock_document_view_documents, mockClsEnv
from sqlalchemy.orm import Session

from documents import crud
from documents.enums import (
    TextOption,
    NumberOption,
    TreeOption,
    DocumentField,
    GroupOption,
)
from documents.schemas import (
    DocumentsQuery,
    SearchField,
    SearchGroup,
    SortOrder,
)
from documents.search import filter_documents_query_base


class TestDocumentsSearch(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        mockClsEnv(cls)

    @classmethod
    def tearDownClass(cls):
        cls.patcher.stop()

    def setUp(self):
        self.db: MagicMock = MagicMock(spec=Session)

    def tearDown(self):
        self.db.close()

    def test_mock_get_user_from_token(self):
        query = DocumentsQuery(
            search_group=SearchGroup(
                option=GroupOption.MatchAll,
                sub_rules=[
                    SearchField(
                        field=DocumentField.Title,
                        option=TextOption.StartsWith,
                        value="A",
                    ),
                    SearchField(
                        field=DocumentField.PagesCount,
                        option=NumberOption.Between,
                        value=(0, 100),
                    ),
                ],
            )
        )

        documents = filter_documents_query_base(
            crud.document_view(self.db), query
        ).all()

        print(documents)
