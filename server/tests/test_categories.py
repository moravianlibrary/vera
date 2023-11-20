import unittest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from helper_funcs import setUpEnv


class TestCategoriesEndpoints(unittest.TestCase):
    def setUp(self):
        setUpEnv()
        from digiboard import app
        self.client = TestClient(app)
        from services.database import get_db
        self.db = next(get_db())

        from categories.crud import create_category
        from categories.schemas import CategoryCreate
        self.name = "Test Category"
        self.delete_category_by_name(self.name)
        self.category_id = create_category(CategoryCreate(name=self.name),
                                           self.db).id

    def delete_category_by_name(self, name: str):
        from categories.crud import get_categories, delete_category
        for category in get_categories(self.db):
            if name == category.name:
                delete_category(category.id, self.db)

    def tearDown(self):
        try:
            from categories.crud import delete_category
            delete_category(self.category_id, self.db)
        except Exception:
            pass

    def test_create_category(self):
        name = "Test Category Name"
        self.delete_category_by_name(name)
        response = self.client.post("/categories", json={"name": name})
        self.assertEqual(response.status_code, 200)
        self.assertTrue("id" in response.json())
        self.assertEqual(name, response.json()['name'])
        self.delete_category_by_name(name)

    def test_update_category(self):
        updated_name = "Updated Test Category"
        response = self.client.put(f"/categories/{self.category_id}",
                                   json={"name": updated_name})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.category_id, response.json()['id'])
        self.assertEqual(updated_name, response.json()['name'])

    def test_delete_category(self):
        response = self.client.delete(f"/categories/{self.category_id}")
        self.assertEqual(response.status_code, 200)

    def test_get_categories(self):
        from categories import crud
        from categories.schemas import Category
        test_categories = [Category(id=1, name="Category 1"),
                           Category(id=2, name="Category 2"),
                           Category(id=3, name="Category 3")]
        result_categories = [{"id": 1, "name": "Category 1"},
                             {"id": 2, "name": "Category 2"},
                             {"id": 3, "name": "Category 3"}]
        crud.get_categories = MagicMock(return_value=test_categories)
        response = self.client.get("/categories")
        self.assertEqual(response.status_code, 200)
        self.assertEquals(result_categories, response.json())
