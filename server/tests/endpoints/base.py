from tests.test_database_base import TestDatabaseBase
from tests.test_base_client import TestClientBase
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from vera import app
from schemas import CurrentUser
from datatypes import ActionType
from routers.utils.dependencies import get_current_user, get_documents_indexer


class TestEndpointsBase(TestDatabaseBase, TestClientBase):
    def setUp(self):
        TestDatabaseBase.setUp(self)
        TestClientBase.setUp(self)
        self.mockTestSuperUser()

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

    def mockTestSuperUser(self, department_id=1, settings={}):
        return self.mockTestUser(
            actions=[action for action in ActionType],
            department_id=department_id,
            settings=settings,
        )

    def mockIndexer(self):
        app.dependency_overrides[get_documents_indexer] = lambda: MagicMock()

    def mockIndexerGetDocumentIds(self, document_ids):
        mock_indexer = MagicMock()
        mock_indexer.get_document_ids.return_value = document_ids
        app.dependency_overrides[get_documents_indexer] = lambda: mock_indexer
