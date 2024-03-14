import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from helper_funcs import get_admin_token, mockClsEnv


class TestCategoriesEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        mockClsEnv(cls)

    @classmethod
    def tearDownClass(cls):
        cls.patcher.stop()

    def setUp(self):
        from vera import app

        self.client = TestClient(app)
        from services.database import get_db

        self.db = next(get_db())

        self.headers = {
            "Authorization": f"Bearer {get_admin_token()}",
            "Content-Type": "application/json",
        }

    def delete_category_by_name(self, name: str):
        from categories.crud import delete_category, get_root_categories
        from documents.crud import delete_document
        from extractions.crud import get_category_documents

        for category in get_root_categories(self.db):
            if category.name == name:
                for document in get_category_documents(category.id, self.db):
                    delete_document(document.id, self.db)
                delete_category(category.id, self.db)

    def delete_document(self, sysno, volume, barcode):
        from documents.crud import get_document_by_identifiers, delete_document

        document = get_document_by_identifiers(sysno, volume, barcode, self.db)
        if document is not None:
            delete_document(document.id, self.db)

    def test_update_root_category(self):
        name = "Test Root Category Name"
        description = "Test Root Category Description"
        updated_name = "Updated Test Category"
        self.delete_category_by_name(updated_name)
        response = self.client.post(
            "/categories/category",
            json={"name": name, "description": description},
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue("id" in response.json())

        category_id = response.json()["id"]
        response = self.client.put(
            f"/categories/category/{category_id}",
            json={"name": updated_name, "description": description},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(category_id, response.json()["id"])
        self.assertEqual(updated_name, response.json()["name"])
        self.assertEqual(description, response.json()["description"])
        self.delete_category_by_name(updated_name)

    def create_test_category_tree(self):
        self.delete_category_by_name("root")
        response = self.client.post(
            "/categories/category", json={"name": "root"}
        )
        root_id = response.json()["id"]
        response = self.client.post(
            "/categories/category",
            json={"name": "child 1", "parent_id": root_id},
        )
        child1_id = response.json()["id"]
        response = self.client.post(
            "/categories/category",
            json={"name": "child 2", "parent_id": root_id},
        )
        child2_id = response.json()["id"]
        response = self.client.post(
            "/categories/category",
            json={"name": "child 3", "parent_id": root_id},
        )
        response = self.client.post(
            "/categories/category",
            json={"name": "grandchild 11", "parent_id": child1_id},
        )
        response = self.client.post(
            "/categories/category",
            json={"name": "grandchild 21", "parent_id": child2_id},
        )
        response = self.client.post(
            "/categories/category",
            json={"name": "grandchild 22", "parent_id": child2_id},
        )
        response = self.client.post(
            "/categories/category",
            json={"name": "grandchild 23", "parent_id": child2_id},
        )

    def test_create_category_tree(self):
        self.create_test_category_tree()

        response = self.client.get("/categories")
        test_tree = [
            item for item in response.json() if item.get("name") == "root"
        ][0]

        # import json
        # print(json.dumps(test_tree, indent=2))

        self.assertIsNotNone(test_tree)
        self.assertEqual(
            [child["name"] for child in test_tree["children"]],
            ["child 1", "child 2", "child 3"],
        )
        child1_tree = [
            child
            for child in test_tree["children"]
            if child["name"] == "child 1"
        ][0]
        child2_tree = [
            child
            for child in test_tree["children"]
            if child["name"] == "child 2"
        ][0]
        child3_tree = [
            child
            for child in test_tree["children"]
            if child["name"] == "child 3"
        ][0]
        self.assertEqual(
            [child["name"] for child in child1_tree["children"]],
            ["grandchild 11"],
        )
        children = [child["name"] for child in child2_tree["children"]]
        children.sort()
        self.assertEqual(
            children,
            ["grandchild 21", "grandchild 22", "grandchild 23"],
        )
        self.assertEqual(
            [child["name"] for child in child3_tree["children"]], []
        )

        self.delete_category_by_name("root")

    def test_delete_subtree(self):
        self.create_test_category_tree()
        from categories.crud import (
            delete_category,
            get_root_categories,
            get_children_categories,
        )

        categories = get_root_categories(self.db)
        curr_category = categories.pop()
        while curr_category:
            children = get_children_categories(curr_category.id, self.db)
            for child in children:
                if child.name == "child 2":
                    delete_category(child.id, self.db)
            categories.extend(children)
            curr_category = categories.pop() if categories else None

        response = self.client.get("/categories")
        test_tree = [
            item for item in response.json() if item.get("name") == "root"
        ][0]
        self.assertIsNotNone(test_tree)
        self.assertEqual(
            [child["name"] for child in test_tree["children"]],
            ["child 1", "child 3"],
        )
        child1_tree = [
            child
            for child in test_tree["children"]
            if child["name"] == "child 1"
        ][0]
        child3_tree = [
            child
            for child in test_tree["children"]
            if child["name"] == "child 3"
        ][0]
        self.assertEqual(
            [child["name"] for child in child1_tree["children"]],
            ["grandchild 11"],
        )
        self.assertEqual(
            [child["name"] for child in child3_tree["children"]], []
        )

        self.delete_category_by_name("root")

    def test_get_categories(self):
        from categories.crud import get_root_categories, update_category
        from categories.schemas import CategoryCreate

        sysno = "MZK01-001002003"
        for volume in ["1996", "1997", "1998"]:
            self.delete_document(sysno, volume, None)

        self.create_test_category_tree()

        roots = get_root_categories(self.db)
        category = [root for root in roots if root.name == "root"][0]
        category.assignable = True
        update_category(
            category.id,
            CategoryCreate(
                name=category.name,
                description=category.description,
                parent_id=category.parent_id,
                assignable=True,
                percentage=category.percentage,
                disabled=category.disabled,
                departments=[],
            ),
            self.db,
        )

        document1 = {
            "sysno": "MZK01-001002003",
            "volume": "1996",
            "title": "Test Document",
            "pages_count": 10,
            "category_id": category.id,
        }
        document2 = {
            "sysno": "MZK01-001002003",
            "volume": "1997",
            "title": "Test Document",
            "category_id": category.id,
        }
        document3 = {
            "sysno": "MZK01-001002003",
            "volume": "1998",
            "title": "Test Document",
            "pages_count": 20,
            "category_id": category.id,
        }

        document_ids = [
            self.client.post(
                "/documents", json=document, headers=self.headers
            ).json()["document"]["id"]
            for document in [document1, document2, document3]
        ]

        response = self.client.get("/categories")
        test_tree = [
            item for item in response.json() if item.get("name") == "root"
        ][0]
        self.assertIsNotNone(test_tree)
        self.assertEqual(
            [child["name"] for child in test_tree["children"]],
            ["child 1", "child 2", "child 3"],
        )
        self.assertEqual(test_tree["count_pages"], 30)
        self.assertEqual(test_tree["count_documents_with_pages"], 2)
        self.assertEqual(test_tree["count_documents"], 3)

        for document_id in document_ids:
            response = self.client.delete(
                f"/documents/{document_id}", headers=self.headers
            )
        self.delete_category_by_name("root")

    def test_category_distribution(self):
        from categories.crud import (
            get_root_categories,
            get_children_categories,
        )

        self.create_test_category_tree()

        roots = get_root_categories(self.db)
        test_root = [root for root in roots if root.name == "root"][0]
        children_ids = [
            child.id
            for child in get_children_categories(test_root.id, self.db)
        ]
        self.assertEqual(len(children_ids), 3)

        distribution = [
            {"id": children_ids[0], "percentage": 40},
            {"id": children_ids[1], "percentage": 29.8},
            {"id": children_ids[2], "percentage": 10.2},
        ]
        self.client.put(
            "/categories/distribution",
            json={"distribution": distribution, "parent_id": roots[0].id},
            headers=self.headers,
        )
        self.delete_category_by_name("root")

    @patch("auth.auth_client.get_user_from_token")
    @patch("categories.crud.create_category")
    @patch("categories.crud.create_root_category")
    @patch("categories.routines.get_category_subtree")
    @patch("categories.routines.has_unique_name")
    def test_create_root_category_access_all_granted(
        self,
        mock_get_user_from_token,
        mock_create_category,
        mock_create_root_category,
        mock_get_category_subtree,
        mock_has_unique_name,
    ):
        from auth.schemas import CurrentUser
        from categories.schemas import Category, CategoryNode
        from roles.types import ActionType

        # Arrange
        name = "Test Root Category Name"
        description = "Test Root Category Description"

        mock_get_user_from_token.return_value = CurrentUser(
            username="test_user",
            department_id=1,
            department_name="test_department",
            role_id=1,
            role_name="test_role",
            actions=[ActionType.EditCategoriesAll.value],
        )
        mock_create_root_category.return_value = Category(
            id=1, name=name, description=description, parent_id=None, level=0
        )
        mock_create_category.return_value = Category(
            id=1, name="child 1", parent_id=1, level=1
        )
        mock_get_category_subtree.return_value = CategoryNode(
            id=1,
            name=name,
            description=description,
            parent_id=None,
            level=0,
            assignable=False,
            percentage=0,
            extract_whole=False,
            disabled=False,
            departments=[],
            children=[],
            count_pages=0,
            count_documents_without_cnb=0,
            count_documents_with_pages=0,
            count_documents=0,
        )
        mock_has_unique_name.return_value = True

        # Act
        response = self.client.post(
            "/categories/category",
            json={"name": name, "description": description},
            headers=self.headers,
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], 1)
        self.assertEqual(response.json()["name"], name)
        self.assertEqual(response.json()["description"], description)
        self.assertIsNone(response.json()["parent_id"])
        self.assertEqual(0, response.json()["level"])
        self.assertFalse(response.json()["assignable"])
        self.assertEqual(0, response.json()["percentage"])
        self.assertFalse(0, response.json()["disabled"])


class TestCategoriesRoutines(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        mockClsEnv(cls)

    @classmethod
    def tearDownClass(cls):
        cls.patcher.stop()

    def setUp(self):
        from services.database import get_db

        self.db = next(get_db())

    def test_read_department_categories(self):
        pass
        # from categories. import
