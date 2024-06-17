import unittest
from unittest.mock import MagicMock
from helper_funcs import mockClsEnv
from sqlalchemy.orm import Session

import models.documents as models
from schemas.types.query_types import (
    TextOption,
    NumberOption,
    DocumentField,
    GroupOption,
)
from schemas.documents_query import (
    DocumentsQuery,
    SearchField,
    SearchGroup,
)
from providers.documents_search import filter_documents_query_base


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
            self.db.query(models.Document), query
        ).all()

        print(documents)
