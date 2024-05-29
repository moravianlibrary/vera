from test_integration import TestIntegration

from unittest.mock import Mock, patch
from tests.helper_funcs import (
    createTestClient,
    createTestUser,
    mockClsEnv,
    mockUser,
    mock_db,
)

from categories.categories.models import Category, CategoryDepartments
from security.models import Department
from categories.categories.schemas import (
    CategoryCreate,
)
from security.types import ActionType


class TestPermissions(TestIntegration):
    @classmethod
    def setUpClass(cls):
        mockClsEnv(cls)

    @classmethod
    def tearDownClass(cls):
        cls.patcher.stop()

    def setUp(self):
        self.client = createTestClient()

    @patch("security.keycloak_client.get_user_from_token")
    def test_mock_get_user_from_token(self, mock_get_user_from_token: Mock):
        from security.keycloak_client import get_user_from_token

        mock_get_user_from_token.return_value = createTestUser()

        self.assertEqual(
            get_user_from_token("test_token", None), createTestUser()
        )

    def test_create_root_category_prohibited(self):
        # Arrange
        mock_db([Category(name="Test Category", parent_id=None, level=0)])
        mockUser(createTestUser())

        # Act
        response = self.client.post(
            "/categories/root",
            json={"name": "Test Category New"},
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(), {"detail": "Insufficient permissions"}
        )

    def test_create_root_category_permitted(self):
        # Arrange
        mock_db([Category(name="Test Category", parent_id=None, level=0)])
        mockUser(createTestUser([ActionType.EditCategoriesAll]))

        # Act
        response = self.client.post(
            "/categories/root",
            json={"name": "Test Category New"},
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert
        self.assertEqual(response.status_code, 200)

    def test_create_department_category_permitted(self):
        # Arrange
        mock_db(
            [
                Category(name="Test Category", parent_id=None, level=0),
                Department(id=10, name="Test Department", abbreviation="TST"),
                CategoryDepartments(category_id=1, department_id=10),
            ]
        )
        mockUser(createTestUser([ActionType.EditCategoriesDepartment]))

        # Act
        response = self.client.post(
            "/categories/1",
            json={"name": "New Test Category"},
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert
        self.assertEqual(response.status_code, 200)

    def test_create_department_category_prohibited(self):
        # Arrange
        mock_db(
            [
                Category(name="Test Category", parent_id=None, level=0),
                Department(id=11, name="Test Department", abbreviation="TST"),
                CategoryDepartments(category_id=1, department_id=11),
            ]
        )
        mockUser(createTestUser([ActionType.EditCategoriesDepartment]))

        # Act
        response = self.client.post(
            "/categories/1",
            json=CategoryCreate(
                name="New Test Category", level=1
            ).model_dump(),
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert
        self.assertEqual(response.status_code, 403)

    def test_create_department_category_permitted_by_edit_all(self):
        # Arrange
        mock_db(
            [
                Category(name="Test Category", parent_id=None, level=0),
                Department(id=11, name="Test Department", abbreviation="TST"),
                CategoryDepartments(category_id=1, department_id=11),
            ]
        )
        mockUser(createTestUser([ActionType.EditCategoriesAll]))

        # Act
        response = self.client.post(
            "/categories/1",
            json={"name": "New Test Category"},
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert
        self.assertEqual(response.status_code, 200)
