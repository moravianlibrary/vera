from unittest import TestCase
from tests.test_database_base import TestDatabaseBase
from fastapi.testclient import TestClient
from vera import app


class TestClientBase(TestCase):
    def setUp(self):
        super().setUp()
        self.client = TestClient(app)
        self.headers = {"Authorization": "Bearer test_token"}
        self.json_headers = {
            "Authorization": "Bearer test_token",
            "Content-Type": "application/json",
        }

    def assertResponseStatusCode(self, response, status_code):
        if response.status_code != status_code:
            raise AssertionError(
                f"Expected status code {status_code}, got {response.status_code}. Body: {response.json()}"
            )
