import asyncio
from typing import Any, Dict, Set, Tuple
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch

from esorm import connect, setup_mappings
from fastapi import Response
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from testcontainers.elasticsearch import ElasticSearchContainer
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer

from adapters.database import BaseModel, get_database_session
from adapters.indexer import _patch_es_meta
from app import app
from config import config
from controllers.resources.resolvers import resolve_authenticated_user
from tests.mock.user import SuperUser

POSTGRES_IMAGE = "postgres:17"
ELASTICSEARCH_IMAGE = "elasticsearch:8.14.0"
REDIS_IMAGE = "redis:8.0"


class TestIntegrationCase(IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.postgres = PostgresContainer(POSTGRES_IMAGE)
        cls.postgres.start()

        cls.engine = create_engine(cls.postgres.get_connection_url())
        cls.SessionLocal = sessionmaker(bind=cls.engine)
        BaseModel.metadata.create_all(cls.engine)

        cls.elasticsearch = ElasticSearchContainer(ELASTICSEARCH_IMAGE)
        cls.elasticsearch.with_env("ES_JAVA_OPTS", "-Xms256m -Xmx256m")
        cls.elasticsearch.with_env("xpack.security.enabled", "false")
        cls.elasticsearch.start()

        cls._patch_is_indexer_available = patch(
            "adapters.indexer.is_indexer_available", new_callable=AsyncMock
        )
        cls.mock_is_indexer_available = cls._patch_is_indexer_available.start()
        cls.mock_is_indexer_available.return_value = True

        cls.redis = RedisContainer(REDIS_IMAGE)
        cls.redis.with_env("maxmemory", "64mb")
        cls.redis.start()

    async def asyncSetUp(self):
        self.es = await connect(
            hosts=self.elasticsearch.get_url(),
            basic_auth=(
                config.elasticsearch.username,
                config.elasticsearch.password,
            ),
            request_timeout=config.elasticsearch.request_timeout,
        )
        _patch_es_meta()

        while not await self.es.ping():
            await asyncio.sleep(0.5)
            message = await self.es.info()
            print(f"Elasticsearch is not ready yet: {message}")

        indices = await self.es.indices.get(index="*")
        for index in indices:
            await self.es.indices.delete(index=index)

        await setup_mappings()

    def setUp(self):
        self.client = AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        )
        self.headers = {"Authorization": "Bearer test_token"}
        self.json_headers = {
            "Authorization": "Bearer test_token",
            "Content-Type": "application/json",
        }

        self.connection = self.engine.connect()
        self.db_session = self.SessionLocal(bind=self.connection)

        BaseModel.metadata.drop_all(bind=self.engine)
        BaseModel.metadata.create_all(bind=self.engine)

        app.dependency_overrides[get_database_session] = (
            lambda: self.db_session
        )
        app.dependency_overrides[resolve_authenticated_user] = (
            lambda: SuperUser()
        )

    def tearDown(self):
        app.dependency_overrides.pop(resolve_authenticated_user, None)
        app.dependency_overrides.pop(get_database_session, None)

        self.db_session.close()
        self.connection.close()

    async def asyncTearDown(self):
        await self.client.aclose()
        await self.es.close()

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
        expected_json: Dict[str, Any] | None = None,
        exclude_paths: Set[Tuple[str, ...]] = frozenset(),
        sort_lists_at_paths: Set[Tuple[str, ...]] = frozenset(),
    ) -> None:
        def _delete_paths(obj: Dict[str, Any], path: Tuple[str, ...]) -> None:
            if not path:
                return

            key = path[0]

            if isinstance(obj, dict):
                if key not in obj:
                    return
                if len(path) == 1:
                    obj.pop(key, None)
                else:
                    _delete_paths(obj[key], path[1:])

            elif isinstance(obj, list):
                for item in obj:
                    _delete_paths(item, path)

        def _sort_list_field(
            obj: Dict[str, Any], path: Tuple[str, ...]
        ) -> None:
            if not path:
                return

            key = path[0]

            if isinstance(obj, dict):
                if key not in obj:
                    return
                if len(path) == 1:
                    if isinstance(obj[key], list):
                        obj[key] = sorted(obj[key], key=lambda x: x.get("id"))
                else:
                    _sort_list_field(obj[key], path[1:])

            elif isinstance(obj, list):
                for item in obj:
                    _sort_list_field(item, path)

        if response.status_code != status_code:
            raise AssertionError(
                f"Expected status code {status_code}, "
                f"got {response.status_code}. Body: {response.json()}"
            )

        if expected_json is not None:
            response_json = response.json()

            for path in exclude_paths:
                _delete_paths(response_json, path)
                _delete_paths(expected_json, path)

            for path in sort_lists_at_paths:
                _sort_list_field(response_json, path)
                _sort_list_field(expected_json, path)

            self.maxDiff = None
            self.assertDictEqual(expected_json, response_json)
        elif response.content:
            raise AssertionError(
                f"Expected empty response body, got {response.content}."
            )
