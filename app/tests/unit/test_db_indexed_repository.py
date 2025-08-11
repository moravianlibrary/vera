import tracemalloc
import unittest
from unittest.mock import AsyncMock, MagicMock, create_autospec, patch

from esorm.fields import boolean, keyword, long
from sqlalchemy import Boolean, Column, Integer, String

from adapters.database import BaseModel, DatabaseSession
from adapters.indexer import IndexerModel, IndexerSession
from repositories._db_indexed_repository import (
    DbIndexedRepository,
    GetByQueryMixin,
    SearchAllMixin,
    SearchCountMixin,
)

tracemalloc.start()


class FakeEntity(BaseModel):
    __tablename__ = "fake_entity_indexed"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    archived = Column(Boolean, nullable=False, default=False)


class FakeModel(IndexerModel):

    class ESConfig:
        index = "fake-index"
        id_field = "id"
        version = "1"

    id: long
    name: keyword
    archived: boolean


class TestRepository(
    DbIndexedRepository[FakeEntity, FakeModel],
    GetByQueryMixin[FakeEntity, FakeModel],
    SearchAllMixin[FakeEntity, FakeModel],
    SearchCountMixin[FakeEntity, FakeModel],
):
    pass


class TestDbIndexedRepository(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.db_session = create_autospec(DatabaseSession)

        patcher = patch("esorm.model.es")
        self.mock_es = patcher.start()
        self.addCleanup(patcher.stop)

        self.indexer_session = create_autospec(IndexerSession)
        self.indexer_session.indices = MagicMock()
        self.indexer_session.get = AsyncMock(
            return_value={
                "_id": "fake_id",
                "_version": 1,
                "_primary_term": 1,
                "_seq_no": 1,
            }
        )
        self.indexer_session.index = AsyncMock(
            return_value={
                "_id": "fake_id",
                "_version": 1,
                "_primary_term": 1,
                "_seq_no": 1,
            }
        )
        self.indexer_session.delete = AsyncMock(
            return_value={
                "_id": "fake_id",
                "_version": 1,
                "_primary_term": 1,
                "_seq_no": 1,
            }
        )
        self.indexer_session.search = AsyncMock()
        self.indexer_session.scroll = AsyncMock()
        self.indexer_session.clear_scroll = AsyncMock()
        self.indexer_session.count = AsyncMock()

        # Patch global proxy
        self.mock_es.indices = self.indexer_session.indices
        self.mock_es.get = self.indexer_session.get
        self.mock_es.index = self.indexer_session.index
        self.mock_es.delete = self.indexer_session.delete
        self.mock_es.search = self.indexer_session.search
        self.mock_es.scroll = self.indexer_session.scroll
        self.mock_es.clear_scroll = self.indexer_session.clear_scroll
        self.mock_es.count = self.indexer_session.count

        self.repo = TestRepository(
            "FakeEntity",
            self.db_session,
            FakeEntity,
            self.indexer_session,
            FakeModel,
        )

        self.item = FakeEntity(id=1, name="TestName")

        def refresh_side_effect(entity):
            if entity.archived is None:
                entity.archived = False

        self.db_session.refresh.side_effect = refresh_side_effect

    def test_has_current_version_schema_true(self):
        self.indexer_session.indices.get_mapping.return_value = {
            "fake-index": {"mappings": {"_meta": {"index.version": "1"}}}
        }

        self.assertTrue(self.repo.has_current_version_schema())

    def test_has_current_version_schema_false(self):
        self.indexer_session.indices.get_mapping.return_value = {
            "fake-index": {"mappings": {"_meta": {"index.version": "0"}}}
        }

        self.assertFalse(self.repo.has_current_version_schema())

    @patch(
        "repositories._db_indexed_repository.setup_mappings",
        new_callable=AsyncMock,
    )
    async def test_recreate_index_when_exists(self, mock_setup_mappings):
        self.indexer_session.indices.exists.return_value = True

        await self.repo.recreate_index()

        self.indexer_session.indices.delete.assert_called_once_with(
            index="fake-index"
        )
        mock_setup_mappings.assert_awaited_once()

    @patch(
        "repositories._db_indexed_repository.setup_mappings",
        new_callable=AsyncMock,
    )
    async def test_recreate_index_when_not_exists(self, mock_setup_mappings):
        self.indexer_session.indices.exists.return_value = False

        await self.repo.recreate_index()

        self.indexer_session.indices.delete.assert_not_called()
        mock_setup_mappings.assert_awaited_once()

    async def test_search(self):
        request = MagicMock()
        request.model_dump.return_value = "expected_body"

        index_response = MagicMock()
        self.indexer_session.search.return_value = index_response

        result = await self.repo.search(request)

        self.indexer_session.search.assert_called_once_with(
            index="fake-index", body=request.model_dump.return_value
        )
        self.assertEqual(result, index_response.body)

    async def test_save(self):
        entity = self.item
        result = await self.repo.save(entity)

        self.db_session.add.assert_called_with(entity)
        self.db_session.commit.assert_called_once()
        self.db_session.refresh.assert_called_with(entity)

        self.indexer_session.index.assert_called_once_with(
            index="fake-index",
            document={"name": "TestName", "archived": False},
            id=1,
            routing=None,
            refresh="wait_for",
            request_timeout=60,
        )

        self.assertEqual(result, entity)

    async def test_index_all(self):
        test_entities = [
            FakeEntity(id=1, name="a", archived=False),
            FakeEntity(id=2, name="b", archived=False),
            FakeEntity(id=3, name="c", archived=False),
            FakeEntity(id=4, name="d", archived=True),
            FakeEntity(id=5, name="e", archived=True),
            FakeEntity(id=6, name="f", archived=False),
            FakeEntity(id=7, name="g", archived=False),
            FakeEntity(id=8, name="h", archived=True),
            FakeEntity(id=9, name="i", archived=False),
            FakeEntity(id=10, name="j", archived=True),
            FakeEntity(id=11, name="k", archived=False),
        ]
        self.db_session.query.return_value.yield_per.return_value = (
            test_entities
        )

        await self.repo.index_all()

        self.db_session.query.assert_called_once_with(FakeEntity)

        self.indexer_session.index.assert_has_calls(
            [
                unittest.mock.call(
                    index="fake-index",
                    document={
                        "name": test_entity.name,
                        "archived": test_entity.archived,
                    },
                    id=test_entity.id,
                    routing=None,
                    refresh="wait_for",
                    request_timeout=60,
                )
                for test_entity in test_entities
            ],
            any_order=True,
        )

    async def test_delete_soft(self):
        entity = FakeEntity(id=1, name="test", archived=False)

        result = await self.repo.delete(
            entity, soft_delete=True, wait_for=True
        )

        self.assertTrue(entity.archived)
        self.assertEqual(result, entity)

    async def test_delete_hard(self):
        entity = FakeEntity(id=1, name="test", archived=False)

        result = await self.repo.delete(
            entity, soft_delete=False, wait_for=True
        )

        self.db_session.delete.assert_called_once_with(entity)
        self.db_session.commit.assert_called_once()

        self.indexer_session.delete.assert_called_once_with(
            index="fake-index",
            id=entity.id,
            routing=None,
            refresh="wait_for",
            request_timeout=60,
        )

        self.assertEqual(result, entity)

    async def test_get_by_query(self):
        self.indexer_session.search.return_value = {
            "_scroll_id": "scroll123",
            "hits": {
                "total": 2,
                "hits": [
                    {"_source": {"id": 1}},
                    {"_source": {"id": 2}},
                ],
            },
        }
        self.indexer_session.scroll.return_value = {
            "_scroll_id": "scroll123",
            "hits": {"total": 0, "hits": []},
        }

        entity1 = FakeEntity(id=1, name="a", archived=False)
        entity2 = FakeEntity(id=2, name="b", archived=False)

        query_mock = MagicMock()
        filter_mock = MagicMock()
        self.db_session.query.return_value = query_mock
        query_mock.filter.side_effect = [filter_mock, filter_mock]
        filter_mock.one.side_effect = [entity1, entity2]

        query = {"query": {"match_all": {}}}
        results = []
        async for entity in self.repo.get_by_query(query):
            results.append(entity)

        self.assertEqual(len(results), 2)
        self.assertEqual(results[0], entity1)
        self.assertEqual(results[1], entity2)

        self.db_session.query.assert_called_with(FakeEntity)
        self.repo._indexer_session.clear_scroll.assert_called_once_with(
            scroll_id="scroll123"
        )

    async def test_search_all(self):
        self.repo._indexer_session.search.return_value = {
            "_scroll_id": "scroll123",
            "hits": {
                "total": 2,
                "hits": [
                    {"_source": {"id": 1, "name": "a", "archived": False}},
                    {"_source": {"id": 2, "name": "b", "archived": False}},
                ],
            },
        }

        self.repo._indexer_session.scroll.return_value = {
            "_scroll_id": "scroll123",
            "hits": {
                "total": 0,
                "hits": [],
            },
        }

        query = {"query": {"match_all": {}}}
        results = []
        async for item in self.repo.search_all(query):
            results.append(item)

        self.assertEqual(len(results), 2)
        self.assertEqual(results[0], FakeModel(id=1, name="a", archived=False))
        self.assertEqual(results[1], FakeModel(id=2, name="b", archived=False))

        self.repo._indexer_session.search.assert_called_once_with(
            index="fake-index", body=query, scroll="1m"
        )
        self.repo._indexer_session.scroll.assert_called_once_with(
            scroll_id="scroll123", scroll="1m"
        )
        self.repo._indexer_session.clear_scroll.assert_called_once_with(
            scroll_id="scroll123"
        )

    async def test_count(self):
        query = {"query": {"match_all": {}}}
        self.repo._indexer_session.count.return_value = {"count": 5}

        count = await self.repo.count(query)

        self.repo._indexer_session.count.assert_called_once_with(
            index="fake-index", body=query
        )
        self.assertEqual(count, 5)
        self.repo._indexer_session.clear_scroll.assert_not_called()
