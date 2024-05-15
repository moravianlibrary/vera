from tests.test_endpoints import TestEndpoints
from unittest.mock import Mock, patch
from tests.helper_funcs import (
    createTestUser,
    get_all_actions_except,
    mockUser,
)

from auth.types import ActionType


class TestAuthEndpoints(TestEndpoints):
    def test_current_user(self):
        # Arange
        test_user = createTestUser()
        mockUser(test_user)

        # Act
        response = self.client.get(
            "/auth/current_user",
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["username"], test_user.username)

    @patch("auth.router.get_users_crud")
    def test_get_users_permitted(self, mock_get_users: Mock):
        # Arange
        mockUser(createTestUser(actions=[ActionType.EditAccess]))
        mock_get_users.return_value = []

        # Act
        response = self.client.get(
            "/auth/users", headers={"Authorization": "Bearer test_token"}
        )

        # Assert
        self.assertEqual(response.status_code, 200)

    def test_get_users_prohibited(self):
        # Arange
        mockUser(
            createTestUser(get_all_actions_except([ActionType.EditAccess]))
        )

        # Act
        response = self.client.get(
            "/auth/users", headers={"Authorization": "Bearer test_token"}
        )

        # Assert
        self.assertEqual(response.status_code, 403)
