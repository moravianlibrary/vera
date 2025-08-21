import unittest
from unittest.mock import create_autospec

from pydantic import BaseModel as PydanticBaseModel
from sqlalchemy import Boolean, Column, Integer, String

from adapters.database import BaseModel, DatabaseSession
from repositories._db_repository import (
    DbRepository,
    EnforceNameUniquenessMixin,
    FindByIdMixin,
    FindByNameMixin,
    FindByNamesMixin,
    GetByIdMixin,
    GetByIdsMixin,
    PaginatedResult,
    PaginationMixin,
)
from schemas.common import PageParams


class FakeEntity(BaseModel):
    __tablename__ = "fake_entity"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    archived = Column(Boolean, default=False)


class FakeFilterParams(PydanticBaseModel):
    name: str


class TestMixinsRepository(
    DbRepository[FakeEntity],
    FindByIdMixin[FakeEntity, int],
    FindByNameMixin[FakeEntity],
    FindByNamesMixin[FakeEntity],
    GetByIdMixin[FakeEntity, int],
    GetByIdsMixin[FakeEntity, int],
    PaginationMixin[FakeEntity],
    EnforceNameUniquenessMixin[FakeEntity, int],
):
    _entity_name = "FakeEntity"
    _db_model = FakeEntity


class TestDbRepository(unittest.TestCase):
    def setUp(self):
        self.db_session = create_autospec(DatabaseSession)
        self.repo = DbRepository(self.db_session)
        self.item = FakeEntity(id=1, name="TestName")

    def test_save(self):
        entity = self.item
        result = self.repo.save(entity)
        self.db_session.add.assert_called_with(entity)
        self.db_session.commit.assert_called_once()
        self.db_session.refresh.assert_called_with(entity)
        self.assertEqual(result, entity)

    def test_hard_delete(self):
        entity = self.item
        result = self.repo.delete(entity)
        self.db_session.delete.assert_called_with(entity)
        self.db_session.commit.assert_called_once()
        self.assertEqual(result, entity)

    def test_soft_delete(self):
        entity = self.item
        result = self.repo.delete(entity, soft_delete=True)
        self.db_session.commit.assert_called_once()
        self.assertTrue(result.archived)
        self.db_session.refresh.assert_called_with(entity)


class TestDbRepositoryMixins(unittest.TestCase):
    def setUp(self):
        self.db_session = create_autospec(DatabaseSession)
        self.repo = TestMixinsRepository(self.db_session)
        self.item = FakeEntity(id=1, name="TestName")

    def test_find_by_id(self):
        query_mock = self.db_session.query.return_value
        query_mock.filter.return_value.first.return_value = self.item
        result = self.repo.find_by_id(1)
        self.assertIsInstance(result, FakeEntity)
        self.db_session.query.assert_called_with(FakeEntity)

    def test_find_by_name(self):
        query_mock = self.db_session.query.return_value
        query_mock.filter.return_value.first.return_value = self.item
        result = self.repo.find_by_name("TestName")
        self.assertIsInstance(result, FakeEntity)

    def test_find_by_names(self):
        query_mock = self.db_session.query.return_value
        query_mock.filter.return_value.all.return_value = [self.item]
        result = self.repo.find_by_names(["TestName"])
        self.assertEqual(len(result), 1)

    def test_get_by_id_success(self):
        query_mock = self.db_session.query.return_value
        query_mock.filter.return_value.first.return_value = self.item
        result = self.repo.get_by_id(1)
        self.assertEqual(result.name, "TestName")

    def test_get_by_id_not_found(self):
        query_mock = self.db_session.query.return_value
        query_mock.filter.return_value.first.return_value = None
        with self.assertRaises(ValueError):
            self.repo.get_by_id(999)

    def test_get_by_ids(self):
        query_mock = self.db_session.query.return_value
        query_mock.filter.return_value.all.return_value = [self.item]
        result = self.repo.get_by_ids([1])
        self.assertEqual(len(result), 1)

    def test_enforce_name_uniqueness_unique(self):
        query_mock = self.db_session.query.return_value
        query_mock.filter.return_value.first.return_value = None
        # Should not raise
        self.repo.enforce_name_uniqueness("UniqueName")

    def test_enforce_name_uniqueness_duplicate(self):
        query_mock = self.db_session.query.return_value
        query_mock.filter.return_value.first.return_value = self.item
        with self.assertRaises(ValueError):
            self.repo.enforce_name_uniqueness("TestName")

    def test_enforce_name_uniqueness_ignores_same_id(self):
        query_mock = self.db_session.query.return_value
        filtered_query = query_mock.filter.return_value
        filtered_query.filter.return_value.first.return_value = None

        try:
            self.repo.enforce_name_uniqueness("TestName", entity_id=1)
        except ValueError:
            self.fail(
                "enforce_name_uniqueness() raised ValueError unexpectedly."
            )

        filtered_query.filter.assert_called_once()

    def test_paginate_with_filters(self):
        query_mock = self.db_session.query.return_value
        filter_mock = query_mock.filter_by.return_value

        ordered = filter_mock.order_by.return_value
        offset = ordered.offset.return_value
        limited = offset.limit.return_value
        limited.all.return_value = [self.item]

        filter_mock.count.return_value = 1

        filter_params = FakeFilterParams(name="TestName")
        page_params = PageParams(offset=0, limit=10)
        results = self.repo.paginate(page_params, filter_params)
        self.assertEqual(results, PaginatedResult([self.item], 1))

        self.db_session.query.assert_called_with(FakeEntity)
        query_mock.filter_by.assert_called_with(name="TestName")

    def test_paginate_without_filters(self):
        query_mock = self.db_session.query.return_value

        ordered = query_mock.order_by.return_value
        offset = ordered.offset.return_value
        limited = offset.limit.return_value
        limited.all.return_value = [self.item]

        query_mock.count.return_value = 1

        page_params = PageParams(offset=0, limit=5)
        results = self.repo.paginate(page_params)
        self.assertEqual(results, PaginatedResult([self.item], 1))

        self.db_session.query.assert_called_with(FakeEntity)
