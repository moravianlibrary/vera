import unittest
from unittest.mock import Mock, patch
from helper_funcs import (
    createTestClient,
    createTestUser,
    get_all_actions_except,
    setUpEnv,
)


from departments.models import Department
from roles.types import ActionType


class TestDepartmentsEndpoints(unittest.TestCase):
    def setUp(self):
        setUpEnv()

    @patch("auth.auth_client.get_user_from_token")
    @patch("departments.crud.create_department")
    def test_create_department_permitted(
        self,
        mock_create_department: Mock,
        mock_get_user_from_token: Mock,
    ):
        # Arrange
        mock_get_user_from_token.return_value = createTestUser(
            [ActionType.EditAccess]
        )
        department_json = {
            "name": "Test Department Name",
            "description": "Test Department Description",
            "users": ["Test User 1", "Test User 2"],
        }
        mock_create_department.return_value = Department(
            id=1,
            name="Test Department Name",
            description="Test Department Description",
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

        # await client.wait_shutdown()

    @patch("auth.auth_client.get_user_from_token")
    @patch("departments.crud.create_department")
    async def test_create_department_prohibited(
        self,
        mock_create_department: Mock,
        mock_get_user_from_token: Mock,
    ):
        # Arrange
        mock_get_user_from_token.return_value = createTestUser(
            get_all_actions_except([ActionType.EditAccess])
        )
        department_json = {
            "name": "Test Department Name",
            "description": "Test Department Description",
            "users": ["Test User 1", "Test User 2"],
        }
        mock_create_department.return_value = Department(
            id=1,
            name="Test Department Name",
            description="Test Department Description",
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

        await client.wait_shutdown()
