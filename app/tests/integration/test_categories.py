from unittest.mock import MagicMock

from repositories.category import CategoryRepository
from tests.integration.case import TestIntegrationCase
from tests.mock.repository import mock_repository


class TestIntegrationCategories(TestIntegrationCase):
    @mock_repository(CategoryRepository)
    def test_search_categories(self, category_repository: MagicMock):
        self.assertResponse(
            self.client.post("/categories/search", json={"query": "test"}),
            200,
        )
