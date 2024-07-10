from tests.test_integration import TestIntegration
from helper_funcs import (
    createTestClient,
    createTestUser,
    get_all_actions_except,
    mockUser,
    mock_db,
)

from schemas.types.action_type import ActionType


class TestDepartmentsIntegration(TestIntegration):
    def test_create_department_permitted(self):
        # Arrange
        mock_db()
        mockUser(createTestUser([ActionType.EditAccess]))
        department_json = {
            "name": "Test Department Name",
            "abbreviation": "TDN",
            "users": ["Test User 1", "Test User 2"],
        }

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

    def test_create_department_prohibited(self):
        # Arrange
        mock_db()
        mockUser(
            createTestUser(get_all_actions_except([ActionType.EditAccess]))
        )
        department_json = {
            "name": "Test Department Name",
            "abbreviation": "TDN",
            "users": ["Test User 1", "Test User 2"],
        }

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
