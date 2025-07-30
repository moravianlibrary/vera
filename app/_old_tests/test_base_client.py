from unittest import TestCase

from fastapi.testclient import TestClient

from app import app


class TestBaseClient(TestCase):
    def setUp(self):
        super().setUp()
        self.client = TestClient(app)
        self.headers = {"Authorization": "Bearer test_token"}
        self.json_headers = {
            "Authorization": "Bearer test_token",
            "Content-Type": "application/json",
        }

    def assertResponse(self, response, status_code, detail=None):
        if response.status_code != status_code:
            raise AssertionError(
                f"Expected status code {status_code}, "
                f"got {response.status_code}. Body: {response.json()}"
            )
        if detail is not None and response.json()["detail"] != detail:
            raise AssertionError(
                f"Expected detail {detail}, got {response.json()['detail']}."
            )
