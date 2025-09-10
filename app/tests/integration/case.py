import asyncio
import atexit
import copy
import logging
import warnings
from dataclasses import dataclass
from typing import Any, Dict, List, Set, Tuple, Type
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch

from elasticsearch.helpers import async_bulk
from esorm import connect, setup_mappings
from fastapi import Response
from httpx import ASGITransport, AsyncClient
from sqlalchemy import Table, create_engine, insert, text
from sqlalchemy.orm import sessionmaker
from testcontainers.elasticsearch import ElasticSearchContainer
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer

from adapters.database import BaseModel, DatabaseSession, get_database_session
from adapters.indexer import IndexerModelType, _patch_es_meta
from app import app
from config import config
from controllers.resources.resolvers import resolve_authenticated_user
from repositories._db_repository import DatabaseEntityType, IdType
from tests.mock.user import SuperUser

logging.basicConfig(level=logging.ERROR)


POSTGRES_IMAGE = "postgres:17"
ELASTICSEARCH_IMAGE = "elasticsearch:8.14.0"
REDIS_IMAGE = "redis:8.0"


@dataclass
class TestIntegrationResources:
    db_session: DatabaseSession
    es_url: str
    client: AsyncClient


@dataclass
class EntitySeed:
    entities: List[DatabaseEntityType]
    indexer_model: Type[IndexerModelType] | None = None


@dataclass
class AssociationSeed:
    table: Table
    assignment: Dict[IdType, List[IdType]]


@dataclass
class ReindexRequest:
    db_model: Type[DatabaseEntityType]
    indexer_model: Type[IndexerModelType]
    ids: List[IdType]


@dataclass
class SequenceSyncRequest:
    table: Table
    target_id: int


SeedData = EntitySeed | AssociationSeed | ReindexRequest | SequenceSyncRequest


class TestIntegrationContext:
    _resources: TestIntegrationResources | None = None
    _started: bool = False
    _lock = asyncio.Lock()

    @classmethod
    async def start(cls):
        if cls._started:
            return

        await cls._lock.acquire()

        if cls._started:
            cls._lock.release()
            return

        # Database
        cls.postgres = PostgresContainer(POSTGRES_IMAGE)
        await asyncio.to_thread(cls.postgres.start)

        cls.engine = create_engine(cls.postgres.get_connection_url())
        cls.SessionLocal = sessionmaker(bind=cls.engine)
        await asyncio.to_thread(BaseModel.metadata.create_all, cls.engine)

        cls.connection = cls.engine.connect()
        cls.db_session = cls.SessionLocal(bind=cls.connection)

        app.dependency_overrides[get_database_session] = lambda: cls.db_session

        # Indexer
        cls.elasticsearch = ElasticSearchContainer(ELASTICSEARCH_IMAGE)
        cls.elasticsearch.with_env("ES_JAVA_OPTS", "-Xms256m -Xmx256m")
        cls.elasticsearch.with_env("xpack.security.enabled", "false")
        await asyncio.to_thread(cls.elasticsearch.start)

        cls.patch_is_indexer_available = patch(
            "adapters.indexer.is_indexer_available", new_callable=AsyncMock
        )
        cls.mock_is_indexer_available = cls.patch_is_indexer_available.start()
        cls.mock_is_indexer_available.return_value = True

        cls.es = await connect(
            hosts=cls.elasticsearch.get_url(),
            basic_auth=(
                config.elasticsearch.username,
                config.elasticsearch.password,
            ),
            request_timeout=config.elasticsearch.request_timeout,
        )
        _patch_es_meta()

        await setup_mappings()

        await cls.es.close()

        # Broker
        cls.redis = RedisContainer(REDIS_IMAGE)
        cls.redis.with_env("maxmemory", "64mb")
        await asyncio.to_thread(cls.redis.start)

        cls.patch_init_task_delay = patch("services.task.init_task.delay")
        cls.mock_init_task_delay = cls.patch_init_task_delay.start()
        cls.mock_init_task_delay.return_value = None

        # User
        app.dependency_overrides[resolve_authenticated_user] = (
            lambda: SuperUser()
        )

        # Client
        cls.client = AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        )

        cls._resources = TestIntegrationResources(
            db_session=cls.db_session,
            es_url=cls.elasticsearch.get_url(),
            client=cls.client,
        )
        cls._started = True

        cls._lock.release()

    @classmethod
    async def stop(cls):
        if not cls._started:
            return

        await cls._lock.acquire()

        if not cls._started:
            cls._lock.release()
            return

        # Database
        app.dependency_overrides.pop(get_database_session, None)

        cls.db_session.close()
        cls.connection.close()

        BaseModel.metadata.drop_all(bind=cls.engine)
        cls.engine.dispose()

        cls.postgres.stop()

        # Indexer
        cls.patch_is_indexer_available.stop()
        cls.elasticsearch.stop()

        # Broker
        # TODO:
        # cls.patch_init_task_delay.stop()
        cls.redis.stop()

        # User
        app.dependency_overrides.pop(resolve_authenticated_user, None)

        # Client
        await cls.client.aclose()

        cls._resources = None
        cls._started = False

        cls._lock.release()

    @classmethod
    async def get_resources(cls) -> TestIntegrationResources:
        await cls.start()
        return cls._resources


def _stop_sync():
    asyncio.run(TestIntegrationContext.stop())


atexit.register(_stop_sync)


class TestIntegrationCase(IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        warnings.simplefilter("ignore", category=DeprecationWarning)

    async def asyncSetUp(self):
        resources = await TestIntegrationContext.get_resources()

        self.db_session = resources.db_session
        self.es = await connect(
            hosts=resources.es_url,
            basic_auth=(
                config.elasticsearch.username,
                config.elasticsearch.password,
            ),
            request_timeout=config.elasticsearch.request_timeout,
        )
        self.client = resources.client

        # Reset database state before each test
        tables = ", ".join(
            table.name for table in BaseModel.metadata.sorted_tables
        )
        self.db_session.execute(
            text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE;")
        )
        self.db_session.commit()

        # Reset indexer state before each test
        await self.es.indices.refresh(index="*")
        await self.es.delete_by_query(
            index="*",
            body={"query": {"match_all": {}}},
            wait_for_completion=True,
            conflicts="proceed",
        )

    async def asyncTearDown(self):
        await self.es.delete_by_query(
            index="*",
            body={"query": {"match_all": {}}},
            wait_for_completion=True,
            conflicts="proceed",
        )
        await self.es.close()

    async def bulk_index(
        self,
        entities: List[DatabaseEntityType],
        indexer_model: Type[IndexerModelType],
    ) -> None:
        index_name = indexer_model.ESConfig.index
        id_field = indexer_model.ESConfig.id_field

        docs = []
        if hasattr(indexer_model, "model_validate_with_views"):
            for db_entity in entities:
                views = db_entity.collect_views(self.db_session)
                docs.append(
                    indexer_model.model_validate_with_views(db_entity, views)
                )
        else:
            for db_entity in entities:
                docs.append(
                    indexer_model.model_validate(
                        db_entity, from_attributes=True
                    )
                )

        _, errors = await async_bulk(
            self.es,
            (
                {
                    "_op_type": "index",
                    "_index": index_name,
                    "_id": doc.__id__,
                    "_source": doc.model_dump(
                        mode="json", exclude={id_field}, exclude_none=True
                    ),
                }
                for doc in docs
            ),
            refresh=True,
        )

        if errors:
            raise RuntimeError(f"Some documents failed to index: {errors}")

    async def _persist_entities(
        self,
        entities: List[DatabaseEntityType],
        indexer_model: Type[IndexerModelType] | None = None,
    ) -> List[DatabaseEntityType]:
        self.db_session.add_all(entities)
        self.db_session.commit()

        for entity in entities:
            self.db_session.refresh(entity)

        if indexer_model:
            await self.bulk_index(entities, indexer_model)

    async def _persist_associations(
        self, table: Table, assignment: Dict[IdType, List[IdType]]
    ) -> None:
        column_1_name = table.columns[0].name
        column_2_name = table.columns[1].name
        self.db_session.execute(
            insert(table).values(
                [
                    {column_1_name: left_id, column_2_name: right_id}
                    for left_id, right_ids in assignment.items()
                    for right_id in right_ids
                ]
            )
        )

        self.db_session.commit()

    async def _reindex(
        self,
        db_model: Type[DatabaseEntityType],
        indexer_model: Type[IndexerModelType],
        ids: List[IdType],
    ) -> None:
        await self.bulk_index(
            self.db_session.query(db_model).filter(db_model.id.in_(ids)).all(),
            indexer_model,
        )

    def _sync_sequence(
        self,
        table: Table,
        target_id: int,
    ) -> None:
        table_name = table.name
        seq_sql = text(
            """
            SELECT setval(
                pg_get_serial_sequence(:table_name, 'id'),
                :target_id,
                false
            )
            """
        )
        self.db_session.execute(
            seq_sql, {"table_name": table_name, "target_id": target_id}
        )
        self.db_session.commit()

    async def seed_test_data(self, seed_data: List[SeedData]) -> None:
        for seed in seed_data:
            if isinstance(seed, EntitySeed):
                await self._persist_entities(
                    [
                        copy.deepcopy(entity)
                        for entity in (
                            seed.entities
                            if isinstance(seed.entities, list)
                            else [seed.entities]
                        )
                    ],
                    seed.indexer_model,
                )
            elif isinstance(seed, AssociationSeed):
                await self._persist_associations(seed.table, seed.assignment)
            elif isinstance(seed, ReindexRequest):
                await self._reindex(
                    seed.db_model, seed.indexer_model, seed.ids
                )
            elif isinstance(seed, SequenceSyncRequest):
                self._sync_sequence(seed.table, seed.target_id)

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

    def assertEntityProperties(
        self,
        db_db_model: Type[DatabaseEntityType],
        entity_id: IdType,
        assert_properties: Dict[str, Any],
    ) -> None:
        db_entity = (
            self.db_session.query(db_db_model)
            .filter_by(id=entity_id)
            .one_or_none()
        )
        if not db_entity:
            raise AssertionError(f"Entity not found: {entity_id}")

        for key, expected_value in assert_properties.items():
            actual_value = getattr(db_entity, key, None)
            self.assertEqual(
                actual_value,
                expected_value,
                f"Unexpected value for {key}: "
                f"{actual_value} != {expected_value}",
            )

    def assertEntityPropertiesPresent(
        self,
        db_db_model: Type[DatabaseEntityType],
        entity_id: IdType,
        assert_properties: Set[str],
    ) -> None:
        db_entity = (
            self.db_session.query(db_db_model)
            .filter_by(id=entity_id)
            .one_or_none()
        )
        if not db_entity:
            raise AssertionError(f"Entity not found: {entity_id}")

        for key in assert_properties:
            if not hasattr(db_entity, key):
                raise AssertionError(f"Property not found: {key}")

            actual_value = getattr(db_entity, key, None)
            if actual_value is None:
                raise AssertionError(f"Property is None: {key}")
