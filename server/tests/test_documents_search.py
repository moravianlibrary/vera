from tests.test_integration import TestIntegration
from tests.helper_funcs import (
    createTestUser,
    mockUser,
    mock_db,
)

from security.types import ActionType


class TestDocumentsSearch(TestIntegration):
    def test_current_user(self):
        # Arange
        mock_db()
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

    def test_get_users_permitted(self):
        # Arange
        mock_db()
        mockUser(createTestUser(actions=[ActionType.EditAccess]))

        # Act
        response = self.client.get(
            "/auth/users", headers={"Authorization": "Bearer test_token"}
        )

        # Assert
        self.assertEqual(response.status_code, 200)
