import unittest
from unittest.mock import patch
from tests.helper_funcs import createTestUser, mockClsEnv


class TestAuthRoutines(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        mockClsEnv(cls)

    @classmethod
    def tearDownClass(cls):
        cls.patcher.stop()

    @patch("security.keycloak_client.get_user_from_token")
    def test_mock_get_user_from_token(self, mock_get_user_from_token):
        mock_get_user_from_token.return_value = createTestUser()

        from security.keycloak_client import get_user_from_token

        self.assertEqual(
            get_user_from_token("test_token", None), createTestUser()
        )
