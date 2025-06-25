from tests.test_base_client import TestBaseClient
from tests.test_base_database import TestBaseDatabase
from tests.test_mock_indexer import TestMockIndexer
from tests.test_mock_user import TestMockUser
from datatypes import ActionType
from typing import List


class TestEndpointsPermissionsBase(
    TestBaseClient, TestBaseDatabase, TestMockIndexer, TestMockUser
):
    def setUp(self):
        TestBaseClient.setUp(self)
        TestBaseDatabase.setUp(self)
        TestMockIndexer.setUp(self)
        TestMockUser.setUp(self)

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
