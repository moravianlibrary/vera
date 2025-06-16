from typing import Generator, Generic, List, Optional

from adapters.indexer import (
    IndexerEntityType,
    IndexerQuery,
    IndexerRequest,
    IndexerResponse,
)

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


class PaginationMixin(Generic[DatabaseEntity]):
    def paginate(
        self: RepositoryContext[DatabaseEntity], page: int, page_size: int
    ) -> List[DatabaseEntity]:
        """
        List models with pagination.
        """
        return (
            self._database_session.query(self._database_entity)
            .sort(self._database_entity.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
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
        self: RepositoryContext, request: IndexerRequest[IndexerEntityType]
    ) -> IndexerResponse[IndexerEntityType]:
        return self._indexer_session.search(request)


class SearchAllMixin(Generic[IndexerEntityType]):
    def search_all(
        self: RepositoryContext, query: IndexerQuery[IndexerEntityType]
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
