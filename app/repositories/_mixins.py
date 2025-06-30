from typing import Generator, Generic, List, Optional

from pydantic import BaseModel

from adapters.indexer import (
    IndexerEntityType,
    IndexerQuery,
    IndexerRequest,
    IndexerResponse,
)
from schemas.common import PageParams

from ._base import DatabaseEntity, IdType, RepositoryContext


class FindByIdMixin(Generic[DatabaseEntity, IdType]):
    def find_by_id(
        self: RepositoryContext[DatabaseEntity], entity_id: IdType
    ) -> Optional[DatabaseEntity]:
        """
        Find a model by its ID.
        """
        return (
            self._database_session.query(self._database_entity)
            .filter(self._database_entity.id == entity_id)
            .first()
        )


class FindByNameMixin(Generic[DatabaseEntity]):
    def find_by_name(
        self: RepositoryContext[DatabaseEntity], name: str
    ) -> Optional[DatabaseEntity]:
        """
        Find a model by its name.
        """
        return (
            self._database_session.query(self._database_entity)
            .filter(self._database_entity.name == name)
            .first()
        )


class FindByNamesMixin(Generic[DatabaseEntity]):
    def find_by_names(
        self: RepositoryContext[DatabaseEntity], names: List[str]
    ) -> List[DatabaseEntity]:
        """
        Find models by their names.
        """
        return (
            self._database_session.query(self._database_entity)
            .filter(self._database_entity.name.in_(names))
            .all()
        )


class GetByIdMixin(Generic[DatabaseEntity, IdType]):
    def get_by_id(
        self: RepositoryContext[DatabaseEntity], entity_id: IdType
    ) -> DatabaseEntity:
        """
        Get a model by its ID.
        """
        entity = (
            self._database_session.query(self._database_entity)
            .filter(self._database_entity.id == entity_id)
            .first()
        )
        if not entity:
            raise ValueError(
                f"{self._entity_name} with ID '{entity_id}' not found"
            )
        return entity


class GetByIdsMixin(Generic[DatabaseEntity, IdType]):
    def get_by_ids(
        self: RepositoryContext[DatabaseEntity], entity_ids: List[IdType]
    ) -> List[DatabaseEntity]:
        """
        Get models by their IDs.
        """
        return (
            self._database_session.query(self._database_entity)
            .filter(self._database_entity.id.in_(entity_ids))
            .all()
        )


class GetByQueryMixin(Generic[IndexerEntityType]):
    def get_by_query(
        self: RepositoryContext, query: IndexerQuery
    ) -> Generator[IndexerEntityType, None, None]:
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


class PaginationMixin(Generic[DatabaseEntity]):
    def paginate(
        self: RepositoryContext[DatabaseEntity],
        page_params: PageParams,
        filter_params: BaseModel | None = None,
    ) -> List[DatabaseEntity]:
        """
        List models with pagination.
        """
        query = self._database_session.query(self._database_entity)
        if filter_params:
            query = query.filter_by(
                **filter_params.model_dump(exclude_unset=True)
            )
        return (
            query.order_by(self._database_entity.id)
            .offset(page_params.offset)
            .limit(page_params.limit)
            .all()
        )


class EnforceNameUniquenessMixin(Generic[DatabaseEntity, IdType]):
    def enforce_name_uniqueness(
        self: RepositoryContext[DatabaseEntity],
        name: str,
        entity_id: IdType | None = None,
    ) -> None:
        """
        Check if the role name is unique.
        """
        query = self._database_session.query(self._database_entity).filter(
            self._database_entity.name == name
        )
        if entity_id:
            query = query.filter(self._database_entity.id != entity_id)
        if query.first() is not None:
            # TODO: Use a custom exception
            raise ValueError(
                f"{self._entity_name} with the name '{name}' already exists"
            )


class SaveMixin(Generic[DatabaseEntity]):
    def save(
        self: RepositoryContext[DatabaseEntity], entity: DatabaseEntity
    ) -> DatabaseEntity:
        """
        Save a model to the database.
        """
        self._database_session.add(entity)
        self._database_session.commit()
        self._database_session.refresh(entity)
        return entity


class DeleteMixin(Generic[DatabaseEntity]):
    def delete(
        self: RepositoryContext[DatabaseEntity], entity: DatabaseEntity
    ) -> DatabaseEntity:
        """
        Delete a model from the database.
        """
        self._database_session.delete(entity)
        self._database_session.commit()
        return entity


class ArchiveOnDeleteMixin(Generic[DatabaseEntity]):
    def delete(
        self: RepositoryContext[DatabaseEntity], entity: DatabaseEntity
    ) -> DatabaseEntity:
        """
        Archive a model instead of deleting it.
        """
        entity.archived = True
        self._database_session.commit()
        return entity


class SearchMixin(Generic[IndexerEntityType]):
    def search(
        self: RepositoryContext, request: IndexerRequest
    ) -> IndexerResponse:
        return self._indexer_session.search(request)


class SearchAllMixin(Generic[IndexerEntityType]):
    def search_all(
        self: RepositoryContext, query: IndexerQuery
    ) -> Generator[IndexerEntityType, None, None]:
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
        return entity
