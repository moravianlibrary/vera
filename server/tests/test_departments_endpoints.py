from tests.test_endpoints import TestEndpoints
from unittest.mock import Mock, patch
from helper_funcs import (
    createTestClient,
    createTestUser,
    get_all_actions_except,
    mockUser,
)

from departments.models import Department
from auth.types import ActionType


class TestDepartmentsEndpoints(TestEndpoints):
    @patch("departments.crud.create_department")
    def test_create_department_permitted(
        self,
        mock_create_department: Mock,
    ):
        # Arrange
        mockUser(createTestUser([ActionType.EditAccess]))
        department_json = {
            "name": "Test Department Name",
            "abbreviation": "TDN",
            "users": ["Test User 1", "Test User 2"],
        }
        mock_create_department.return_value = Department(
            id=1,
            name="Test Department Name",
            abbreviation="TDN",
            users=["Test User 1", "Test User 2"],
        )

        # Act
        client = createTestClient()
        response = client.post(
            "/departments",
            json=department_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(200, response.status_code)
        self.assertEqual(1, mock_create_department.call_count)

    @patch("departments.crud.create_department")
    def test_create_department_prohibited(
        self,
        mock_create_department: Mock,
    ):
        # Arrange
        mockUser(
            createTestUser(get_all_actions_except([ActionType.EditAccess]))
        )
        department_json = {
            "name": "Test Department Name",
            "abbreviation": "TDN",
            "users": ["Test User 1", "Test User 2"],
        }
        mock_create_department.return_value = Department(
            id=1,
            name="Test Department Name",
            abbreviation="TDN",
            users=["Test User 1", "Test User 2"],
        )

        # Act
        client = createTestClient()
        response = client.post(
            "/departments",
            json=department_json,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(403, response.status_code)
        self.assertEqual(0, mock_create_department.call_count)
