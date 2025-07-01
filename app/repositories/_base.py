from typing import Protocol, Type, TypeVar, Union

from sqlalchemy.orm import DeclarativeMeta

from adapters.database import DatabaseSession
from adapters.indexer import IndexerEntity, IndexerSession

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
        indexer_entity: Type[IndexerEntity],
    ):
        super().__init__(entity_name, database_session, database_entity)
        self._indexer_session = indexer_session
        self._indexer_entity = indexer_entity


class IndexedRepositoryContext(RepositoryContext[DatabaseEntity]):
    _indexer_session: IndexerSession
    _indexer_entity: Type[IndexerEntity]
