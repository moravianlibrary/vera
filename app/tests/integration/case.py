from unittest import TestCase

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from adapters.database import BaseModel, get_database_session
from vera import app

test_engine = create_engine(
    "sqlite:///:memory:", connect_args={"check_same_thread": False}
)
TestSessionLocal = sessionmaker(
    autocommit=False, autoflush=True, bind=test_engine
)


class TestIntegrationCase(TestCase):
    @classmethod
    def setUpClass(cls):
        BaseModel.metadata.create_all(test_engine)

    def setUp(self):
        self.client = TestClient(app)
        self.headers = {"Authorization": "Bearer test_token"}
        self.json_headers = {
            "Authorization": "Bearer test_token",
            "Content-Type": "application/json",
        }

        self.connection = test_engine.connect()
        self.transaction = self.connection.begin()
        self.session = TestSessionLocal(bind=self.connection)
        self.session.execute(text("PRAGMA foreign_keys=ON;"))

        app.dependency_overrides[get_database_session] = (
            lambda: TestSessionLocal(bind=self.connection)
        )

    def tearDown(self):
        self.transaction.rollback()
        self.session.close()
        self.connection.close()

    @classmethod
    def tearDownClass(cls):
        BaseModel.metadata.drop_all(test_engine)

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
