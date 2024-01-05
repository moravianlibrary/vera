import unittest
from fastapi.testclient import TestClient
from helper_funcs import get_admin_token, setUpEnv


class TestAuthEndpoints(unittest.TestCase):
    def setUp(self):
        setUpEnv()

        from digiboard import app
        self.client = TestClient(app)

    def test_current_user(self):
        token = get_admin_token()
        response = self.client.get(
            "/auth/current_user",
            headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200  # Expecting a 200 OK status code
