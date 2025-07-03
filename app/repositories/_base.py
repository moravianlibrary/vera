from typing import Protocol, Type, TypeVar, Union

from sqlalchemy.orm import DeclarativeMeta

from adapters.database import DatabaseSession
from adapters.indexer import IndexerModel, IndexerSession

DatabaseEntity = TypeVar("DatabaseEntity", bound=DeclarativeMeta)
IdType = TypeVar("IdType", bound=Union[str, int])


class BaseRepository:
    def __init__(
        self,
        entity_name: str,
        database_session: DatabaseSession,
        database_entity: Type[DatabaseEntity],
    ):
        """
        Initialize repository with the session, model and entity name.
        """
        self._entity_name = entity_name
        self._database_session = database_session
        self._database_entity = database_entity


class RepositoryContext(Protocol[DatabaseEntity]):
    _entity_name: str
    _database_session: DatabaseSession
    _database_entity: Type[DatabaseEntity]


class BaseIndexedRepository(BaseRepository):
    def __init__(
        self,
        entity_name: str,
        database_session: DatabaseSession,
        database_entity: Type[DatabaseEntity],
        indexer_session: IndexerSession,
        indexer_entity: Type[IndexerModel],
    ):
        super().__init__(entity_name, database_session, database_entity)
        self._indexer_session = indexer_session
        self._indexer_entity = indexer_entity

    def has_current_version_schema(self) -> bool:
        current_mapping = self._indexer_session.indices.get_mapping(
            index=self._indexer_entity.__index_name__
        ).get(self._indexer_entity.__index_name__, {})

        if not current_mapping:
            return False

        return (
            current_mapping.get("mappings", {})
            .get("_meta", {})
            .get("index.version", None)
            == self._indexer_entity.__index_version__
        )

    def recreate_index(self):
        if self._indexer_session.indices.exists(
            index=self._indexer_entity.__index_name__
        ):
            self._indexer_session.indices.delete(
                index=self._indexer_entity.__index_name__
            )
        self._indexer_session.indices.create(
            index=self._indexer_entity.__index_name__,
            body=self._indexer_entity.es_schema(),
        )

    def refresh_index(self):
        self._indexer_session.indices.refresh(
            index=self._indexer_entity.__index_name__
        )


class IndexedRepositoryContext(RepositoryContext[DatabaseEntity]):
    _indexer_session: IndexerSession
    _indexer_entity: Type[IndexerModel]
