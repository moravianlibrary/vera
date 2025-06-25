from unittest.mock import MagicMock

from repositories.category import CategoryRepository
from tests.integration.case import TestIntegrationCase
from tests.mock.repository import mock_repository


class TestIntegrationCategories(TestIntegrationCase):
    @mock_repository(CategoryRepository)
    def test_search_categories(self, category_repository: MagicMock):
        response = self.client.post(
            "/categories/search", params={"query": "test"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("categories", response.json())
        self.assertIsInstance(response.json()["categories"], list)
        self.assertIsInstance(response.json()["categories"], list)
