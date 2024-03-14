import unittest
from unittest.mock import patch
from tests.helper_funcs import createTestUser, setUpEnv


class TestAuthRoutines(unittest.TestCase):
    def setUp(self):
        setUpEnv()

    @patch("auth.auth_client.get_user_from_token")
    def test_mock_get_user_from_token(self, mock_get_user_from_token):
        mock_get_user_from_token.return_value = createTestUser()

        from auth.auth_client import get_user_from_token

        self.assertEqual(
            get_user_from_token("test_token", None), createTestUser()
        )
