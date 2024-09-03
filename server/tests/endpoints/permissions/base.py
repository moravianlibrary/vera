import unittest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from vera import app
from schemas import CurrentUser
from datatypes import ActionType
from routers.utils.dependencies import get_current_user, get_documents_indexer
from typing import List


from services.database import Base, get_db

test_engine = create_engine(
    "sqlite:///:memory:", connect_args={"check_same_thread": False}
)
TestSessionLocal = sessionmaker(
    autocommit=False, autoflush=True, bind=test_engine
)


class TestEndpointsPermissionsBase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(test_engine)

    def setUp(self):
        self.connection = test_engine.connect()
        self.transaction = self.connection.begin()
        self.session = TestSessionLocal(bind=self.connection)
        self.session.execute(text("PRAGMA foreign_keys=ON;"))

        app.dependency_overrides[get_db] = lambda: TestSessionLocal(
            bind=self.connection
        )

        self.client = TestClient(app)
        self.headers = {"Authorization": "Bearer test_token"}
        self.json_headers = {
            "Authorization": "Bearer test_token",
            "Content-Type": "application/json",
        }

    def tearDown(self):
        self.transaction.rollback()
        self.session.close()
        self.connection.close()

    @classmethod
    def tearDownClass(cls):
        Base.metadata.drop_all(test_engine)

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
        mock_indexer = unittest.mock.MagicMock()
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
        print(response.json())
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
        self.assertEndpointPermitted(
            http_method, endpoint, tested_action, success_status_code
        )
        self.assertEndpointProhited(
            http_method,
            endpoint,
            [tested_action],
            failure_status_code,
            failure_error_message,
        )
