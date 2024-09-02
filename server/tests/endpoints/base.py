import unittest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from vera import app
from schemas import CurrentUser
from datatypes import ActionType
from routers.utils.dependencies import get_current_user


from services.database import Base, get_db

test_engine = create_engine(
    "sqlite:///:memory:", connect_args={"check_same_thread": False}
)
TestSessionLocal = sessionmaker(
    autocommit=False, autoflush=True, bind=test_engine
)


class TestEndpointsBase(unittest.TestCase):
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
        self.mockTestSuperUser()

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

    def mockTestSuperUser(self, department_id=1, settings={}):
        return self.mockTestUser(
            actions=[action for action in ActionType],
            department_id=department_id,
            settings=settings,
        )
