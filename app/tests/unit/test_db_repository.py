import unittest
from unittest.mock import create_autospec

from sqlalchemy import Column, Integer, String

from adapters.database import BaseModel, DatabaseSession
from repositories._db_repository import (
    DbRepository,
    DeleteMixin,
    EnforceNameUniquenessMixin,
    FindByIdMixin,
    FindByNameMixin,
    FindByNamesMixin,
    GetByIdMixin,
    GetByIdsMixin,
    SaveMixin,
)


class FakeEntity(BaseModel):
    __tablename__ = "fake_entity"
    id = Column(Integer, primary_key=True)
    name = Column(String)


class RepositoryUnderTest(
    DbRepository,
    FindByIdMixin,
    FindByNameMixin,
    FindByNamesMixin,
    GetByIdMixin,
    GetByIdsMixin,
    SaveMixin,
    DeleteMixin,
    EnforceNameUniquenessMixin,
):
    pass


class TestRepositoryMixins(unittest.TestCase):
    def setUp(self):
        self.db_session = create_autospec(DatabaseSession)
        self.repo = RepositoryUnderTest(
            "FakeEntity", self.db_session, FakeEntity
        )
        self.item = FakeEntity(id=1, name="TestName")

    def test_find_by_id(self):
        for mapper in BaseModel.registry.mappers:
            print(mapper.class_)
        query_mock = self.db_session.query.return_value
        query_mock.filter.return_value.first.return_value = self.item
        result = self.repo.find_by_id(1)
        self.assertIsInstance(result, FakeEntity)
        self.db_session.query.assert_called_with(FakeEntity)

    # def test_find_by_name(self):
    #     query_mock = self.db_session.query.return_value
    #     query_mock.filter.return_value.first.return_value = self.item
    #     result = self.repo.find_by_name("TestName")
    #     self.assertIsInstance(result, FakeEntity)

    # def test_find_by_names(self):
    #     query_mock = self.db_session.query.return_value
    #     query_mock.filter.return_value.all.return_value = [self.item]
    #     result = self.repo.find_by_names(["TestName"])
    #     self.assertEqual(len(result), 1)

    # def test_get_by_id_success(self):
    #     query_mock = self.db_session.query.return_value
    #     query_mock.filter.return_value.first.return_value = self.item
    #     result = self.repo.get_by_id(1)
    #     self.assertEqual(result.name, "TestName")

    # def test_get_by_id_not_found(self):
    #     query_mock = self.db_session.query.return_value
    #     query_mock.filter.return_value.first.return_value = None
    #     with self.assertRaises(ValueError):
    #         self.repo.get_by_id(999)

    # def test_get_by_ids(self):
    #     query_mock = self.db_session.query.return_value
    #     query_mock.filter.return_value.all.return_value = [self.item]
    #     result = self.repo.get_by_ids([1])
    #     self.assertEqual(len(result), 1)

    # def test_save(self):
    #     entity = self.item
    #     result = self.repo.save(entity)
    #     self.db_session.add.assert_called_with(entity)
    #     self.db_session.commit.assert_called_once()
    #     self.db_session.refresh.assert_called_with(entity)
    #     self.assertEqual(result, entity)

    # def test_delete(self):
    #     entity = self.item
    #     result = self.repo.delete(entity)
    #     self.db_session.delete.assert_called_with(entity)
    #     self.db_session.commit.assert_called_once()
    #     self.assertEqual(result, entity)

    # def test_enforce_name_uniqueness_unique(self):
    #     query_mock = self.db_session.query.return_value
    #     query_mock.filter.return_value.first.return_value = None
    #     # Should not raise
    #     self.repo.enforce_name_uniqueness("UniqueName")

    # def test_enforce_name_uniqueness_duplicate(self):
    #     query_mock = self.db_session.query.return_value
    #     query_mock.filter.return_value.first.return_value = self.item
    #     with self.assertRaises(ValueError):
    #         self.repo.enforce_name_uniqueness("TestName")
