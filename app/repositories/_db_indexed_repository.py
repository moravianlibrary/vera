from typing import Generator, Generic, Type

from adapters.database import DatabaseSession
from adapters.indexer import (
    IndexerModel,
    IndexerModelType,
    IndexerQuery,
    IndexerRequest,
    IndexerResponse,
    IndexerSession,
)

from ._db_repository import DatabaseEntity, DbRepository, DbRepositoryContext


class DbIndexedRepository(DbRepository):
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


class DbIndexedRepositoryContext(DbRepositoryContext[DatabaseEntity]):
    _indexer_session: IndexerSession
    _indexer_entity: Type[IndexerModel]


class GetByQueryMixin(Generic[IndexerModelType]):
    def get_by_query(
        self: DbIndexedRepositoryContext, query: IndexerQuery
    ) -> Generator[IndexerModelType, None, None]:
        scroll_id = None

        while True:
            response = (
                self._indexer_session.scroll(scroll_id=scroll_id, scroll="1m")
                if scroll_id
                else self._indexer_session.search(
                    index=self._indexer_entity.__index_name__,
                    body=query,
                    scroll="1m",
                    fields=[self._indexer_entity.__id_field__],
                )
            )

            for hit in response["hits"]["hits"]:
                yield self._database_session.query(
                    self._database_entity
                ).filter(
                    self._database_entity.getattr(
                        self._indexer_entity.__id_field__
                    )
                    == hit["_source"][self._indexer_entity.__id_field__]
                ).one()

            scroll_id = response.get("_scroll_id")
            if not scroll_id or response["hits"]["total"] == 0:
                break


class SearchMixin(Generic[IndexerModelType]):
    def search(
        self: DbIndexedRepositoryContext, request: IndexerRequest
    ) -> IndexerResponse:
        return self._indexer_session.search(request)


class SearchAllMixin(Generic[IndexerModelType]):
    def search_all(
        self: DbIndexedRepositoryContext, query: IndexerQuery
    ) -> Generator[IndexerModelType, None, None]:
        scroll_id = None

        while True:
            response = (
                self._indexer_session.scroll(scroll_id=scroll_id, scroll="1m")
                if scroll_id
                else self._indexer_session.search(
                    index=self._indexer_entity.__index_name__,
                    body=query,
                    scroll="1m",
                )
            )

            for hit in response["hits"]["hits"]:
                yield self._indexer_entity.model_validate(hit["_source"])

            scroll_id = response.get("_scroll_id")
            if not scroll_id or response["hits"]["total"] == 0:
                break

        self._indexer_session.clear_scroll(scroll_id=scroll_id)


class SearchCountMixin(Generic[IndexerModelType]):
    def count(self: DbIndexedRepositoryContext, query: IndexerQuery) -> int:
        response = self._indexer_session.count(
            index=self._indexer_entity.__index_name__, body=query
        )
        return response["count"]


class SaveAndIndexMixin(Generic[DatabaseEntity]):
    def save_and_index(
        self: DbIndexedRepositoryContext[DatabaseEntity],
        entity: DatabaseEntity,
        wait_for: bool = False,
    ) -> DatabaseEntity:
        """
        Save a model to the database and index it.
        """
        self._database_session.add(entity)
        self._database_session.commit()
        self._database_session.refresh(entity)

        indexer_entity = self._indexer_entity.model_validate(entity)

        self._indexer_session.index(
            index=self._indexer_entity.__index_name__,
            id=indexer_entity.getattr(self._indexer_entity.__id_field__, None),
            body=indexer_entity,
            refresh="true" if wait_for else None,
        )

        return entity


class DeleteAndUnindexMixin(Generic[DatabaseEntity]):
    def delete(
        self: DbIndexedRepositoryContext[DatabaseEntity],
        entity: DatabaseEntity,
        wait_for: bool = False,
    ) -> DatabaseEntity:
        """
        Delete a model from the database and unindex it.
        """
        self._indexer_session.delete(
            index=self._indexer_entity.__index_name__,
            id=entity.getattr(self._indexer_entity.__id_field__, None),
            refresh="true" if wait_for else None,
        )

        self._database_session.delete(entity)
        self._database_session.commit()
        return entity


class ArchiveOnDeleteAndIndexMixin(Generic[DatabaseEntity]):
    def delete(
        self: DbIndexedRepositoryContext[DatabaseEntity],
        entity: DatabaseEntity,
        wait_for: bool = False,
    ) -> DatabaseEntity:
        """
        Archive a model instead of deleting it and index it.
        """
        entity.archived = True
        self._database_session.commit()
        self._database_session.refresh(entity)

        indexer_entity = self._indexer_entity.model_validate(entity)

        self._indexer_session.index(
            index=self._indexer_entity.__index_name__,
            id=indexer_entity.getattr(self._indexer_entity.__id_field__, None),
            body=indexer_entity,
            refresh="true" if wait_for else None,
        )

        return indexer_entity


class IndexerMixin:
    def reindex_all(self: DbIndexedRepositoryContext) -> None:
        """
        Reindex all entities in the indexer.
        """
        for entity in self._database_session.query(
            self._database_entity
        ).all():
            self._indexer_session.reindex(
                index=self._indexer_entity.__index_name__,
                id=entity.getattr(self._indexer_entity.__id_field__, None),
                body=self._indexer_entity.model_validate(entity),
            )


class IndexMixin(Generic[DatabaseEntity]):
    def index(
        self: DbIndexedRepositoryContext[DatabaseEntity],
        entity: DatabaseEntity,
        wait_for: bool = False,
    ) -> None:
        indexer_entity = self._indexer_entity.model_validate(entity)

        self._indexer_session.index(
            index=self._indexer_entity.__index_name__,
            id=indexer_entity.getattr(self._indexer_entity.__id_field__, None),
            body=indexer_entity,
            refresh="true" if wait_for else None,
        )


class ArchiveMixin(Generic[DatabaseEntity]):
    def archive(
        self: DbIndexedRepositoryContext[DatabaseEntity],
        entity: DatabaseEntity,
        wait_for: bool = False,
    ) -> DatabaseEntity:
        entity.is_archived = True
        self._database_session.commit()
        self._database_session.refresh(entity)

        self.index(entity, wait_for)

        return entity
