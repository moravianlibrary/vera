import unittest
from fastapi.testclient import TestClient
from helper_funcs import get_admin_token, setUpEnv


class TestCategoriesEndpoints(unittest.TestCase):
    def setUp(self):
        setUpEnv()
        from digiboard import app
        self.client = TestClient(app)
        from services.database import get_db
        self.db = next(get_db())
        self.clear_categories()

        self.headers = {
            'Authorization': f'Bearer {get_admin_token()}',
            'Content-Type': 'application/json'
            }

    def clear_categories(self):
        from categories.crud import get_root_categories, delete_category
        for category in get_root_categories(self.db):
            delete_category(category.id, self.db)

    def delete_category_by_name(self, name: str):
        from categories.crud import get_root_categories, delete_category
        for category in get_root_categories(self.db):
            if name == category.name:
                delete_category(category.id, self.db)

    def test_create_root_category(self):
        name = "Test Root Category Name"
        description = "Test Root Category Description"
        response = self.client.post("/categories", json={
            "name": name,
            "description": description
            })
        self.assertEqual(response.status_code, 200)
        self.assertTrue("id" in response.json())
        self.assertEqual(name, response.json()['name'])
        self.assertEqual(description, response.json()['description'])
        self.assertIsNone(response.json()['parent_id'])
        self.assertEqual(0, response.json()['level'])
        self.assertFalse(response.json()['assignable'])
        self.assertEqual(0, response.json()['percentage'])
        self.assertFalse(0, response.json()['disabled'])
        self.delete_category_by_name(name)

    def test_update_root_category(self):
        name = "Test Root Category Name"
        description = "Test Root Category Description"
        updated_name = "Updated Test Category"
        response = self.client.post("/categories", json={
            "name": name,
            "description": description
            })
        self.assertEqual(response.status_code, 200)
        self.assertTrue("id" in response.json())

        category_id = response.json()['id']
        response = self.client.put(f"/categories/{category_id}", json={
            "name": updated_name,
            "description": description
            })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(category_id, response.json()['id'])
        self.assertEqual(updated_name, response.json()['name'])
        self.assertEqual(description, response.json()['description'])
        self.delete_category_by_name(updated_name)

    def create_test_category_tree(self):
        response = self.client.post("/categories", json={"name": "root"})
        root_id = response.json()['id']
        response = self.client.post("/categories", json={
            "name": "child 1",
            "parent_id": root_id
            })
        child1_id = response.json()['id']
        response = self.client.post("/categories", json={
            "name": "child 2",
            "parent_id": root_id
            })
        child2_id = response.json()['id']
        response = self.client.post("/categories", json={
            "name": "child 3",
            "parent_id": root_id
            })
        response = self.client.post("/categories", json={
            "name": "grandchild 11",
            "parent_id": child1_id
            })
        response = self.client.post("/categories", json={
            "name": "grandchild 21",
            "parent_id": child2_id
            })
        response = self.client.post("/categories", json={
            "name": "grandchild 22",
            "parent_id": child2_id
            })
        response = self.client.post("/categories", json={
            "name": "grandchild 23",
            "parent_id": child2_id
            })

    def test_create_category_tree(self):
        self.create_test_category_tree()

        response = self.client.get("/categories")
        test_tree = response.json()['name' == "root"]
        import json
        print(json.dumps(test_tree, indent=2))
        self.assertIsNotNone(test_tree)
        self.assertEqual([child['name'] for child in test_tree['children']],
                         ['child 1', 'child 2', 'child 3'])
        child1_tree = [child for child in test_tree['children']
                       if child['name'] == "child 1"][0]
        child2_tree = [child for child in test_tree['children']
                       if child['name'] == "child 2"][0]
        child3_tree = [child for child in test_tree['children']
                       if child['name'] == "child 3"][0]
        self.assertEqual([child['name'] for child in child1_tree['children']],
                         ['grandchild 11'])
        self.assertEqual([child['name'] for child in child2_tree['children']],
                         ['grandchild 21', 'grandchild 22', 'grandchild 23'])
        self.assertEqual([child['name'] for child in child3_tree['children']],
                         [])

        self.delete_category_by_name("root")

    def test_delete_subtree(self):
        self.create_test_category_tree()
        self.delete_category_by_name("child 2")

        response = self.client.get("/categories")
        test_tree = response.json()['name' == "root"]
        self.assertIsNotNone(test_tree)
        self.assertEqual([child['name'] for child in test_tree['children']],
                         ['child 1', 'child 3'])
        child1_tree = [child for child in test_tree['children']
                       if child['name'] == "child 1"][0]
        child3_tree = [child for child in test_tree['children']
                       if child['name'] == "child 3"][0]
        self.assertEqual([child['name'] for child in child1_tree['children']],
                         ['grandchild 11'])
        self.assertEqual([child['name'] for child in child3_tree['children']],
                         [])

        self.delete_category_by_name("root")

    def clear_documents(self):
        from documents.crud import get_documents_query_base, \
            get_documents, delete_document
        documents_ids = [document.id for document
                         in get_documents(get_documents_query_base(self.db))]
        for document_id in documents_ids:
            delete_document(document_id, self.db)

    def test_get_categories(self):
        from categories.crud import get_root_categories, update_category
        from categories.schemas import CategoryCreate

        self.clear_documents()
        self.create_test_category_tree()

        category = get_root_categories(self.db)[0]
        category.assignable = True
        update_category(category.id, CategoryCreate(
            name=category.name,
            description=category.description,
            parent_id=category.parent_id,
            assignable=True,
            percentage=category.percentage,
            disabled=category.disabled,
            departments=[]
        ), self.db)

        document1 = {
            "sysno": "MZK01-001002003",
            "volume_number": "1996",
            "item_number": "10",
            "title": "Test Document",
            "pages_count": 10,
            "category_id": category.id
        }
        document2 = {
            "sysno": "MZK01-001002003",
            "volume_number": "1997",
            "item_number": "10",
            "title": "Test Document",
            "category_id": category.id
        }
        document3 = {
            "sysno": "MZK01-001002003",
            "volume_number": "1998",
            "item_number": "10",
            "title": "Test Document",
            "pages_count": 20,
            "category_id": category.id
        }

        self.client.post("/documents",
                         json=document1,
                         headers=self.headers)
        self.client.post("/documents",
                         json=document2,
                         headers=self.headers)
        self.client.post("/documents",
                         json=document3,
                         headers=self.headers)

        response = self.client.get("/categories")
        test_tree = response.json()['name' == "root"]
        self.assertIsNotNone(test_tree)
        self.assertEqual([child['name'] for child in test_tree['children']],
                         ['child 1', 'child 2', 'child 3'])
        self.assertEqual(test_tree['count_pages'], 30)
        self.assertEqual(test_tree['count_documents_with_pages'], 2)
        self.assertEqual(test_tree['count_documents'], 3)

        self.clear_documents()
        self.delete_category_by_name("root")
