import unittest
from unittest.mock import patch
from helper_funcs import (
    createTestClient,
    createTestUser,
    setUpEnv,
)


from roles.types import ActionType


class TestCategoriesEndpoints(unittest.TestCase):
    def setUpClass(self):
        setUpEnv()

    @patch("auth.auth_client.get_user_from_token")
    @patch("categories.crud.create_root_category")
    @patch("categories.routines.get_category_subtree")
    @patch("categories.routines.has_unique_name")
    async def test_create_root_category_permitted(
        self,
        mock_has_unique_name,
        mock_get_category_subtree,
        mock_create_root_category,
        mock_get_user_from_token,
    ):
        from categories.schemas import Category, CategoryNode

        # Arrange
        test_user = createTestUser([ActionType.EditCategoriesAll])
        name = "Test Root Category Name"
        description = "Test Root Category Description"
        category_json = {"name": name, "description": description}

        mock_has_unique_name.return_value = True
        mock_get_user_from_token.return_value = test_user
        mock_create_root_category.return_value = Category(
            id=1, name=name, description=description, parent_id=None, level=0
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

        client = createTestClient()

        # Act
        response = client.post(
            "/categories/category",
            json=category_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], 1)
        self.assertEqual(response.json()["name"], name)
        self.assertEqual(response.json()["description"], description)
        self.assertIsNone(response.json()["parent_id"])
        self.assertEqual(response.json()["level"], 0)
        self.assertFalse(response.json()["assignable"])
        self.assertEqual(response.json()["percentage"], 0)
        self.assertFalse(response.json()["disabled"], 0)

        await client.wait_shutdown()

    @patch("auth.auth_client.get_user_from_token")
    @patch("categories.crud.create_category")
    @patch("categories.crud.get_category_departments")
    @patch("categories.routines.get_category_subtree")
    @patch("categories.routines.has_unique_name")
    async def test_create_category_permitted_for_user_department(
        self,
        mock_has_unique_name,
        mock_get_category_subtree,
        mock_get_category_departments,
        mock_create_category,
        mock_get_user_from_token,
    ):
        from categories.schemas import Category, CategoryNode
        from categories.models import CategoryDepartments

        # Arrange
        test_user = createTestUser([ActionType.EditCategoriesDepartment])
        name = "Test Root Category Name"
        description = "Test Root Category Description"
        parent_id = 1
        category_json = {
            "name": name,
            "description": description,
            "parent_id": parent_id,
        }

        mock_get_user_from_token.return_value = test_user
        mock_has_unique_name.return_value = True
        mock_get_category_departments.return_value = [
            CategoryDepartments(
                category_id=parent_id,
                department_id=test_user.department_id,
            )
        ]
        mock_create_category.return_value = Category(
            id=2, name=name, description=description, parent_id=1, level=1
        )
        mock_get_category_subtree.return_value = CategoryNode(
            id=2,
            name=name,
            description=description,
            parent_id=1,
            level=1,
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

        client = createTestClient()

        # Act
        response = client.post(
            "/categories/category",
            json=category_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], 2)
        self.assertEqual(response.json()["name"], name)
        self.assertEqual(response.json()["description"], description)
        self.assertEqual(response.json()["parent_id"], 1)
        self.assertEqual(response.json()["level"], 1)
        self.assertFalse(response.json()["assignable"])
        self.assertEqual(response.json()["percentage"], 0)
        self.assertFalse(response.json()["disabled"], 0)

        await client.wait_shutdown()

    @patch("auth.auth_client.get_user_from_token")
    @patch("categories.crud.get_category_departments")
    @patch("categories.routines.has_unique_name")
    async def test_create_category_permitted_for_different_department(
        self,
        mock_has_unique_name,
        mock_get_category_departments,
        mock_get_user_from_token,
    ):
        from categories.models import CategoryDepartments

        # Arrange
        test_user = createTestUser([ActionType.EditCategoriesDepartment])
        name = "Test Root Category Name"
        description = "Test Root Category Description"
        parent_id = 1
        category_json = {
            "name": name,
            "description": description,
            "parent_id": parent_id,
        }

        mock_get_user_from_token.return_value = test_user
        mock_has_unique_name.return_value = True
        mock_get_category_departments.return_value = [
            CategoryDepartments(
                category_id=parent_id,
                department_id=11,
            )
        ]

        client = createTestClient()

        # Act
        response = client.post(
            "/categories/category",
            json=category_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 403)

        await client.wait_shutdown()

    @patch("auth.auth_client.get_user_from_token")
    @patch("categories.crud.get_category_departments")
    @patch("categories.routines.has_unique_name")
    async def test_create_category_prohibited_but_with_user_department(
        self,
        mock_has_unique_name,
        mock_get_category_departments,
        mock_get_user_from_token,
    ):
        from categories.models import CategoryDepartments

        # Arrange
        test_user = createTestUser()
        name = "Test Root Category Name"
        description = "Test Root Category Description"
        parent_id = 1
        category_json = {
            "name": name,
            "description": description,
            "parent_id": parent_id,
        }

        mock_get_user_from_token.return_value = test_user
        mock_has_unique_name.return_value = True
        mock_get_category_departments.return_value = [
            CategoryDepartments(
                category_id=parent_id,
                department_id=test_user.department_id,
            )
        ]

        client = createTestClient()

        # Act
        response = client.post(
            "/categories/category",
            json=category_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 403)

        await client.wait_shutdown()

    @patch("auth.auth_client.get_user_from_token")
    @patch("categories.routines.has_unique_name")
    async def test_create_category_unique_name_violation(
        self,
        mock_has_unique_name,
        mock_get_user_from_token,
    ):
        # Arrange
        test_user = createTestUser()
        name = "Test Root Category Name"
        description = "Test Root Category Description"
        parent_id = 1
        category_json = {
            "name": name,
            "description": description,
            "parent_id": parent_id,
        }

        mock_get_user_from_token.return_value = test_user
        mock_has_unique_name.return_value = False

        client = createTestClient()

        # Act
        response = client.post(
            "/categories/category",
            json=category_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 403)

        await client.wait_shutdown()

    @patch("auth.auth_client.get_user_from_token")
    @patch("categories.routines.has_unique_name")
    @patch("categories.crud.get_category")
    @patch("categories.crud.update_category")
    async def test_update_category_permitted(
        self,
        mock_update_category,
        mock_get_category,
        mock_has_unique_name,
        mock_get_user_from_token,
    ):
        from categories.schemas import Category

        # Arrange
        test_user = createTestUser([ActionType.EditCategoriesAll])
        category_id = 2
        old_name = "Test Category Old Name"
        name = "Test Category Name"
        description = "Test Category Description"
        parent_id = 1
        category_json = {
            "name": name,
            "description": description,
            "parent_id": parent_id,
        }

        mock_get_user_from_token.return_value = test_user
        mock_has_unique_name.return_value = True
        mock_get_category.return_value = Category(
            id=category_id,
            name=old_name,
            description=description,
            parent_id=1,
            level=1,
        )
        mock_update_category.return_value = Category(
            id=category_id,
            name=name,
            description=description,
            parent_id=1,
            level=1,
        )

        client = createTestClient()

        # Act
        response = client.put(
            f"/categories/category/{category_id}",
            json=category_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], 2)
        self.assertEqual(response.json()["name"], name)
        self.assertEqual(response.json()["description"], description)
        self.assertEqual(response.json()["parent_id"], 1)
        self.assertEqual(response.json()["level"], 1)
        self.assertFalse(response.json()["assignable"])
        self.assertEqual(response.json()["percentage"], 0)
        self.assertFalse(response.json()["disabled"], 0)

        await client.wait_shutdown()

    @patch("auth.auth_client.get_user_from_token")
    async def test_update_category_prohibited(
        self,
        mock_get_user_from_token,
    ):
        # Arrange
        test_user = createTestUser([])
        category_id = 2
        name = "Test Category Name"
        description = "Test Category Description"
        parent_id = 1
        category_json = {
            "name": name,
            "description": description,
            "parent_id": parent_id,
        }

        mock_get_user_from_token.return_value = test_user

        client = createTestClient()

        # Act
        response = client.put(
            f"/categories/category/{category_id}",
            json=category_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 403)

        await client.wait_shutdown()

    @patch("auth.auth_client.get_user_from_token")
    @patch("categories.crud.get_enabled_for_parent")
    @patch("categories.crud.update_distribution")
    async def test_update_distribution_permitted(
        self,
        mock_update_distribution,
        mock_get_enabled_for_parent,
        mock_get_user_from_token,
    ):
        from categories.schemas import Category

        # Arrange
        test_user = createTestUser([ActionType.EditCategoriesAll])
        input_data = [
            {"id": 2, "percentage": 50.0},
            {"id": 3, "percentage": 50.0},
        ]
        child_categories = [
            Category(
                id=2,
                name="Test Category 1",
                level=1,
                parent_id=1,
                percentage=50,
            ),
            Category(
                id=3,
                name="Test Category 2",
                level=1,
                parent_id=1,
                percentage=50,
            ),
        ]

        mock_get_user_from_token.return_value = test_user
        mock_get_enabled_for_parent.return_value = child_categories
        mock_update_distribution.return_value = None

        client = createTestClient()

        # Act
        response = client.put(
            "/categories/distribution?parent_id=1",
            json=input_data,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        await client.wait_shutdown()

    @patch("auth.auth_client.get_user_from_token")
    @patch("categories.crud.get_category")
    @patch("categories.crud.delete_category")
    async def test_delete_category_permitted(
        self,
        mock_delete_category,
        mock_get_category,
        mock_get_user_from_token,
    ):
        from categories.schemas import Category

        # Arrange
        test_user = createTestUser([ActionType.EditCategoriesAll])
        test_category = Category(
            id=2,
            name="Test Category 1",
            level=1,
            parent_id=1,
            percentage=0,
        )

        mock_get_user_from_token.return_value = test_user
        mock_get_category.return_value = test_category
        mock_delete_category.return_value = test_category

        client = createTestClient()

        # Act
        response = client.delete(
            "/categories/category/2",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)

        await client.wait_shutdown()

    @patch("auth.auth_client.get_user_from_token")
    @patch("categories.crud.get_root_categories")
    @patch("categories.crud.get_category_departments")
    @patch("categories.crud.get_children_categories")
    @patch("categories.crud.get_pages_count")
    @patch("categories.crud.get_documents_without_cnb_count")
    @patch("categories.crud.get_documents_count")
    async def test_get_root_categories_permitted_all(
        self,
        mock_get_documents_count,
        mock_get_documents_without_cnb_count,
        mock_get_pages_count,
        mock_get_children_categories,
        mock_get_category_departments,
        mock_get_root_categories,
        mock_get_user_from_token,
    ):
        from categories.schemas import Category

        # Arrange
        test_user = createTestUser([ActionType.ReadCategoriesAll])
        test_root_category = [
            Category(
                id=1,
                name="Test Root Category 1",
                level=0,
                parent_id=None,
                percentage=0,
            ),
            Category(
                id=2,
                name="Test Root Category 2",
                level=0,
                parent_id=None,
                percentage=0,
            ),
        ]

        mock_get_user_from_token.return_value = test_user
        mock_get_root_categories.return_value = test_root_category
        mock_get_category_departments.return_value = []
        mock_get_children_categories.return_value = []
        mock_get_pages_count.return_value = 0
        mock_get_documents_count.return_value = 0
        mock_get_documents_without_cnb_count.return_value = 0

        client = createTestClient()

        # Act
        response = client.get(
            "/categories",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        for node in response.json():
            self.assertIn(node["id"], [1, 2])
            self.assertEqual(node["level"], 0)

        await client.wait_shutdown()

    @patch("auth.auth_client.get_user_from_token")
    async def test_get_root_categories_prohibited_all(
        self,
        mock_get_user_from_token,
    ):
        # Arrange
        mock_get_user_from_token.return_value = createTestUser()

        client = createTestClient()

        # Act
        response = client.get(
            "/categories",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 403)

        await client.wait_shutdown()
