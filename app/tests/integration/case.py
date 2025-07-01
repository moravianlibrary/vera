from unittest import TestCase

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from testcontainers.postgres import PostgresContainer

from adapters.database import BaseModel, get_database_session
from vera import app

POSTGRES_IMAGE = "postgres:17"


class TestIntegrationCase(TestCase):
    @classmethod
    def setUpClass(cls):
        cls.postgres = PostgresContainer(POSTGRES_IMAGE)
        cls.postgres.start()

        cls.db_url = cls.postgres.get_connection_url()
        cls.engine = create_engine(cls.db_url)
        cls.SessionLocal = sessionmaker(bind=cls.engine)

        BaseModel.metadata.create_all(cls.engine)

    def setUp(self):
        self.client = TestClient(app)
        self.headers = {"Authorization": "Bearer test_token"}
        self.json_headers = {
            "Authorization": "Bearer test_token",
            "Content-Type": "application/json",
        }

        self.connection = self.engine.connect()
        self.transaction = self.connection.begin()
        self.session = self.SessionLocal(bind=self.connection)

        app.dependency_overrides[get_database_session] = (
            lambda: self.SessionLocal(bind=self.connection)
        )

    def tearDown(self):
        self.transaction.rollback()
        self.session.close()
        self.connection.close()

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()
        cls.postgres.stop()

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
