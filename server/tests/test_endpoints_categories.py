import unittest
from unittest.mock import patch
from helper_funcs import createTestClient, createTestUser, setUpEnv


class TestCategoriesEndpoints(unittest.TestCase):
    def setUp(self):
        setUpEnv()

    @patch("auth.auth_client.get_user_from_token")
    @patch("categories.crud.create_category")
    @patch("categories.crud.create_root_category")
    @patch("categories.routines.get_category_subtree")
    @patch("categories.routines.has_unique_name")
    def test_create_root_category_access_department_granted(
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

        from vera import app
        from auth.auth_client import oauth2_scheme, get_user_from_token

        def mock_oauth2_scheme():
            return "test_token"

        def mock_get_user_from_token_f():
            return CurrentUser(
                username="test_user",
                department_id=1,
                department_name="test_department",
                role_id=1,
                role_name="test_role",
                actions=[ActionType.EditCategoriesDepartment.value],
            )

        app.dependency_overrides[oauth2_scheme] = mock_oauth2_scheme
        app.dependency_overrides[get_user_from_token] = (
            mock_get_user_from_token_f
        )
        mock_get_user_from_token.return_value = CurrentUser(
            username="test_user",
            department_id=1,
            department_name="test_department",
            role_id=1,
            role_name="test_role",
            actions=[ActionType.EditCategoriesDepartment.value],
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
            headers={
                # "Authorization": "Bearer random_token",
                "X-Token": "coneofsilence",
                "Content-Type": "application/json",
            },
        )

        # Assert
        print(response.json())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], 1)
        self.assertEqual(response.json()["name"], name)
        self.assertEqual(response.json()["description"], description)
        self.assertIsNone(response.json()["parent_id"])
        self.assertEqual(0, response.json()["level"])
        self.assertFalse(response.json()["assignable"])
        self.assertEqual(0, response.json()["percentage"])
        self.assertFalse(0, response.json()["disabled"])
