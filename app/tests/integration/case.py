from typing import Any
from unittest import TestCase

from fastapi import Response
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from testcontainers.elasticsearch import ElasticSearchContainer
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer

from adapters.database import BaseModel, get_database_session
from app import app
from controllers.resources.resolvers import resolve_authenticated_user
from tests.mock.user import SuperUser

POSTGRES_IMAGE = "postgres:17"
ELASTICSEARCH_IMAGE = "elasticsearch:8.14.0"
REDIS_IMAGE = "redis:8.0"


class TestIntegrationCase(TestCase):
    @classmethod
    def setUpClass(cls):
        cls.postgres = PostgresContainer(POSTGRES_IMAGE)
        cls.postgres.start()

        cls.elasticsearch = ElasticSearchContainer(ELASTICSEARCH_IMAGE)
        cls.elasticsearch.with_env("ES_JAVA_OPTS", "-Xms256m -Xmx256m")
        cls.elasticsearch.with_env("xpack.security.enabled", "false")
        cls.elasticsearch.start()

        cls.redis = RedisContainer(REDIS_IMAGE)
        cls.redis.with_env("maxmemory", "64mb")
        cls.redis.start()

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
        app.dependency_overrides[resolve_authenticated_user] = (
            lambda: SuperUser()
        )

    def tearDown(self):
        app.dependency_overrides.pop(get_database_session, None)
        app.dependency_overrides.pop(resolve_authenticated_user, None)

        self.transaction.rollback()
        self.session.close()
        self.connection.close()

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()

        cls.postgres.stop()
        cls.elasticsearch.stop()
        cls.redis.stop()

    def assertResponse(
        self,
        response: Response,
        status_code: int,
        detail: Any | None = None,
    ) -> None:
        if response.status_code != status_code:
            raise AssertionError(
                f"Expected status code {status_code}, "
                f"got {response.status_code}. Body: {response.json()}"
            )

        response_json = response.json()

        if detail is not None:
            if "detail" not in response_json:
                raise AssertionError(
                    f'Missing "detail" in response: {response_json}'
                )
            if response_json["detail"] != detail:
                raise AssertionError(
                    f"Expected detail {detail}, got {response_json['detail']}."
                )
        elif "detail" in response_json:
            raise AssertionError(
                "Did not expect 'detail' in response, "
                f"but got: {response_json['detail']}"
            )
