import unittest
from unittest.mock import Mock, patch
from tests.helper_funcs import createTestClient, createTestUser, mockClsEnv

from categories.schemas import Category, CategoryCreate, CategoryNode
from auth.types import ActionType


class TestPermissions(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        mockClsEnv(cls)

    @classmethod
    def tearDownClass(cls):
        cls.patcher.stop()

    def setUp(self):
        self.client = createTestClient()

    @patch("auth.auth_client.get_user_from_token")
    def test_mock_get_user_from_token(self, mock_get_user_from_token: Mock):
        from auth.keycloak_client import get_user_from_token

        mock_get_user_from_token.return_value = createTestUser()

        self.assertEqual(
            get_user_from_token("test_token", None), createTestUser()
        )

    @patch("auth.facade.get_user_from_token")
    @patch("categories.facade.create_root_category")
    def test_create_root_category_prohibited(
        self, mock_create_root_category: Mock, mock_get_user_from_token: Mock
    ):
        # Arrange
        mock_get_user_from_token.return_value = createTestUser()
        mock_create_root_category.return_value = CategoryNode(
            id=1,
            level=0,
            name="Test Category",
            children=[],
            count_pages=0,
            count_pages_extractable=0,
            count_documents=0,
            count_documents_with_pages=0,
            count_documents_extractable=0,
            count_documents_without_cnb=0,
        )

        # Act
        response = self.client.post(
            "/categories/category",
            json=CategoryCreate(name="Test Category", level=0).model_dump(),
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(), {"detail": "Insufficient permissions"}
        )

    @patch("auth.facade.get_user_from_token")
    @patch("categories.facade.create_root_category")
    def test_create_root_category_permitted(
        self, mock_create_root_category: Mock, mock_get_user_from_token: Mock
    ):
        # Arrange
        mock_get_user_from_token.return_value = createTestUser(
            [ActionType.EditCategoriesAll]
        )
        mock_create_root_category.return_value = CategoryNode(
            id=1,
            level=0,
            name="Test Category",
            children=[],
            count_pages=0,
            count_pages_extractable=0,
            count_documents=0,
            count_documents_with_pages=0,
            count_documents_extractable=0,
            count_documents_without_cnb=0,
        )

        # Act
        response = self.client.post(
            "/categories/category",
            json=CategoryCreate(name="Test Category", level=0).model_dump(),
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert
        self.assertEqual(response.status_code, 200)

    @patch("auth.facade.get_user_from_token")
    @patch("categories.crud.get_category")
    @patch("categories.facade.create_category")
    def test_create_department_category_permitted(
        self,
        mock_create_category: Mock,
        mock_get_category: Mock,
        mock_get_user_from_token: Mock,
    ):
        # Arrange
        mock_get_user_from_token.return_value = createTestUser(
            [ActionType.EditCategoriesDepartment]
        )
        mock_get_category.return_value = Category(
            id=1,
            level=0,
            name="Test Category",
            departments=[10],
        )
        mock_create_category.return_value = CategoryNode(
            id=2,
            level=1,
            name="New Test Category",
            children=[],
            count_pages=0,
            count_pages_extractable=0,
            count_documents=0,
            count_documents_with_pages=0,
            count_documents_extractable=0,
            count_documents_without_cnb=0,
        )

        # Act
        response = self.client.post(
            "/categories/category/1",
            json=CategoryCreate(
                name="New Test Category", level=1
            ).model_dump(),
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert
        self.assertEqual(response.status_code, 200)

    @patch("auth.facade.get_user_from_token")
    @patch("categories.crud.get_category")
    @patch("categories.facade.create_category")
    def test_create_department_category_prohibited(
        self,
        mock_create_category: Mock,
        mock_get_category: Mock,
        mock_get_user_from_token: Mock,
    ):
        # Arrange
        mock_get_user_from_token.return_value = createTestUser(
            [ActionType.EditCategoriesDepartment]
        )
        mock_get_category.return_value = Category(
            id=1,
            level=0,
            name="Test Category",
            departments=[11],
        )
        mock_create_category.return_value = CategoryNode(
            id=2,
            level=1,
            name="New Test Category",
            children=[],
            count_pages=0,
            count_pages_extractable=0,
            count_documents=0,
            count_documents_with_pages=0,
            count_documents_extractable=0,
            count_documents_without_cnb=0,
        )

        # Act
        response = self.client.post(
            "/categories/category/1",
            json=CategoryCreate(
                name="New Test Category", level=1
            ).model_dump(),
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert
        self.assertEqual(response.status_code, 403)
