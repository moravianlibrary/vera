import unittest
from unittest.mock import Mock, patch

from tests.helper_funcs import createTestUser, mockClsEnv

from roles.types import ActionType


class TestAuthEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        mockClsEnv(cls)

    @classmethod
    def tearDownClass(cls):
        cls.patcher.stop()

    def setUp(self):
        import importlib

        importlib.invalidate_caches()

    # @patch("auth.auth_client.get_user_from_token")
    @patch("auth.router.get_user_from_token")
    def test_current_user(self, mock_get_user_from_token: Mock):
        # Arange
        test_user = createTestUser()
        mock_get_user_from_token.return_value = test_user

        from tests.helper_funcs import createTestClient

        client = createTestClient()

        # Act
        response = client.get(
            "/auth/current_user",
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["username"], test_user.username)

    @patch("auth.dependencies.get_user_from_token")
    @patch("auth.router.get_users_crud")
    def test_get_users_permitted(
        self, mock_get_users: Mock, mock_get_user_from_token: Mock
    ):
        # Arange
        mock_get_user_from_token.return_value = createTestUser(
            actions=[ActionType.EditAccess]
        )
        mock_get_users.return_value = []

        from tests.helper_funcs import createTestClient

        client = createTestClient()

        # Act
        response = client.get(
            "/auth/users", headers={"Authorization": "Bearer test_token"}
        )

        # Assert
        self.assertEqual(response.status_code, 200)

    @patch("auth.dependencies.get_user_from_token", autospec=True)
    def test_get_users_prohibited(self, mock_get_user_from_token: Mock):
        # Arange
        test_user = createTestUser()
        mock_get_user_from_token.return_value = test_user

        from tests.helper_funcs import createTestClient

        client = createTestClient()

        # Act
        response = client.get(
            "/auth/users", headers={"Authorization": "Bearer test_token"}
        )

        # Assert
        self.assertEqual(response.status_code, 403)
