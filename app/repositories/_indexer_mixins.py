from typing import Generator, Generic

from adapters.indexer import (
    IndexerModelType,
    IndexerQuery,
    IndexerRequest,
    IndexerResponse,
)

from ._base import DatabaseEntity, RepositoryContext


class GetByQueryMixin(Generic[IndexerModelType]):
    def get_by_query(
        self: RepositoryContext, query: IndexerQuery
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
        self: RepositoryContext, request: IndexerRequest
    ) -> IndexerResponse:
        return self._indexer_session.search(request)


class SearchAllMixin(Generic[IndexerModelType]):
    def search_all(
        self: RepositoryContext, query: IndexerQuery
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


class SaveAndIndexMixin(Generic[DatabaseEntity]):
    def save_and_index(
        self: RepositoryContext[DatabaseEntity],
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
        self: RepositoryContext[DatabaseEntity],
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
        self: RepositoryContext[DatabaseEntity],
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
    def reindex_all(self: RepositoryContext) -> None:
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
        self: RepositoryContext[DatabaseEntity],
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
        self: RepositoryContext[DatabaseEntity],
        entity: DatabaseEntity,
        wait_for: bool = False,
    ) -> DatabaseEntity:
        entity.is_archived = True
        self._database_session.commit()
        self._database_session.refresh(entity)

        self.index(entity, wait_for)

        return entity
