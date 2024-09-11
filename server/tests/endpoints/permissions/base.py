from tests.test_database_base import TestBaseDatabase
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from vera import app
from schemas import CurrentUser
from datatypes import ActionType
from routers.utils.dependencies import get_current_user, get_documents_indexer
from typing import List


class TestEndpointsPermissionsBase(TestBaseDatabase):
    def setUp(self):
        super().setUp()

        self.client = TestClient(app)
        self.headers = {"Authorization": "Bearer test_token"}
        self.json_headers = {
            "Authorization": "Bearer test_token",
            "Content-Type": "application/json",
        }

    def mockTestUser(self, actions=[], department_id=1, settings={}):
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            username="test_user",
            department_id=department_id,
            department_name="test_department",
            role_id=1,
            role_name="test_role",
            actions=actions,
            settings=settings,
        )

    def mockTestAntiUser(self, actions=[], department_id=1, settings={}):
        return self.mockTestUser(
            actions=[action for action in ActionType if action not in actions],
            department_id=department_id,
            settings=settings,
        )

    def mockIndexerGetDocumentIds(self, document_ids):
        mock_indexer = MagicMock()
        mock_indexer.get_document_ids.return_value = document_ids
        app.dependency_overrides[get_documents_indexer] = lambda: mock_indexer

    def assertEndpointPermitted(
        self,
        http_method: str,
        endpoint: str,
        required_action: ActionType,
        expected_status_code: int = 200,
    ):
        self.mockTestUser([required_action])
        response = self.client.request(
            http_method, endpoint, headers=self.headers
        )
        self.assertEqual(response.status_code, expected_status_code)

    def assertEndpointProhited(
        self,
        http_method: str,
        endpoint: str,
        tested_actions: List[ActionType],
        expected_status_code: int = 403,
        expected_error_message: str = "Insufficient permissions",
    ):
        self.mockTestAntiUser(tested_actions)
        response = self.client.request(
            http_method, endpoint, headers=self.headers
        )
        self.assertEqual(response.status_code, expected_status_code)
        if expected_error_message is not None:
            self.assertEqual(response.json()["detail"], expected_error_message)

    def assertEndpointPermission(
        self,
        http_method: str,
        endpoint: str,
        tested_action: ActionType,
        success_status_code: int = 200,
        failure_status_code: int = 403,
        failure_error_message: str = "Insufficient permissions",
    ):
        self.assertEndpointProhited(
            http_method,
            endpoint,
            [tested_action],
            failure_status_code,
            failure_error_message,
        )
        self.assertEndpointPermitted(
            http_method, endpoint, tested_action, success_status_code
        )
