import unittest
from fastapi.testclient import TestClient


class TestAuthEndpoints(unittest.TestCase):
    def setUp(self):
        from helper_funcs import setUpEnv

        setUpEnv()

        from vera import app

        self.client = TestClient(app)

    def test_current_user(self):
        from helper_funcs import get_admin_token

        token = get_admin_token()
        response = self.client.get(
            "/auth/current_user", headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200

    def test_get_users(self):
        from helper_funcs import get_admin_token, get_test_user_token

        token = get_admin_token()
        response = self.client.get(
            "/auth/users", headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200

        token = get_test_user_token()
        response = self.client.get(
            "/auth/users", headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403
