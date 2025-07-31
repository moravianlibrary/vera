import asyncio
from typing import AsyncGenerator, Generator, Generic, Protocol, Type

from esorm import setup_mappings

from adapters.database import DatabaseSession
from adapters.indexer import (
    IndexerModelType,
    IndexerQuery,
    IndexerRequest,
    IndexerResponse,
    IndexerSession,
)

from ._db_repository import DatabaseEntityType, DbRepository


# ------------------------------------
# - Base Indexed Database Repository -
# ------------------------------------
class DbIndexedRepository(
    DbRepository, Generic[DatabaseEntityType, IndexerModelType]
):
    """
    Base repository class integrating both database and indexer operations.

    Parameters
    ----------
    entity_name : str
        The name of the entity managed by this repository.
    database_session : DatabaseSession
        Database session for performing DB operations.
    database_entity : Type[DatabaseEntityType]
        SQLAlchemy model class representing the database entity.
    indexer_session : IndexerSession
        Indexer indexer session for index operations.
    indexer_entity : Type[IndexerModelType]
        Pydantic model class representing the index document.

    Methods
    -------
    has_current_version_schema() -> bool
        Checks if the indexer has the current version schema.
    recreate_index() -> None
        Deletes and recreates the index using
        the schema defined by the indexer entity.
    refresh_index() -> None
        Refreshes the index to make recent changes searchable.
    """

    def __init__(
        self,
        entity_name: str,
        database_session: DatabaseSession,
        database_entity: Type[DatabaseEntityType],
        indexer_session: IndexerSession,
        indexer_entity: Type[IndexerModelType],
    ):
        super().__init__(entity_name, database_session, database_entity)
        self._indexer_session = indexer_session
        self._indexer_entity = indexer_entity

    def has_current_version_schema(self) -> bool:
        """
        Check if the current index mapping schema matches the entity's version.

        Returns
        -------
        bool
            True if the index schema matches the expected version;
            False otherwise.
        """
        index = self._indexer_entity.ESConfig.index

        mapping = self._indexer_session.indices.get_mapping(index=index).get(
            index, {}
        )

        return mapping.get("mappings", {}).get("_meta", {}).get(
            "index.version"
        ) == getattr(self._indexer_entity.ESConfig, "version", None)

    async def recreate_index(self):
        """
        Delete and recreate the index
        using the schema defined by the indexer entity.
        """
        index = self._indexer_entity.ESConfig.index

        if self._indexer_session.indices.exists(index=index):
            self._indexer_session.indices.delete(index=index)

        await setup_mappings()

    async def search(self, request: IndexerRequest) -> IndexerResponse:
        """
        Perform a search using the indexer and return the raw response.

        Parameters
        ----------
        request : IndexerRequest
            The request object containing query and parameters.

        Returns
        -------
        IndexerResponse
            Raw response from the indexer search.
        """
        return await self._indexer_session.search(
            index=self._indexer_entity.ESConfig.index, body=request
        )

    async def save(
        self, entity: DatabaseEntityType, wait_for: bool = False
    ) -> DatabaseEntityType:
        """
        Save an entity to the database and index it.

        Parameters
        ----------
        entity : DatabaseEntityType
            The entity to persist and index.
        wait_for : bool, optional
            Whether to wait for the indexing to refresh.

        Returns
        -------
        DatabaseEntityType
            The saved and indexed entity.
        """
        self._database_session.add(entity)
        self._database_session.commit()
        self._database_session.refresh(entity)

        index_doc = self._indexer_entity.model_validate(
            entity, from_attributes=True
        )
        await index_doc.save(wait_for=wait_for)

        return entity

    async def index_all(self) -> None:
        semaphore = asyncio.BoundedSemaphore(10)

        async def save_entity(entity):
            async with semaphore:
                await self._indexer_entity.model_validate(
                    entity, from_attributes=True
                ).save()

        entities = self._database_session.query(
            self._database_entity
        ).yield_per(1000)

        # gather tasks incrementally
        tasks = set()
        for entity in entities:
            task = asyncio.create_task(save_entity(entity))
            tasks.add(task)

            # When we have 10 concurrent tasks, wait for some to finish
            if len(tasks) >= 10:
                _, tasks = await asyncio.wait(
                    tasks, return_when=asyncio.FIRST_COMPLETED
                )

        # wait for remaining tasks
        if tasks:
            await asyncio.gather(*tasks)

    async def delete(
        self,
        entity: DatabaseEntityType,
        soft_delete: bool = False,
        wait_for: bool = False,
    ) -> DatabaseEntityType:
        """
        Delete or archive an entity in the database
        and remove it from the index.

        If `soft_delete` is True, the entity is marked as archived instead
        of being physically deleted. In this case, the entity is saved
        and reindexed. Otherwise, the entity is deleted from the database
        and unindexed.

        Parameters
        ----------
        entity : DatabaseEntityType
            The entity to delete and unindex.
        soft_delete : bool, optional
            Whether to mark the entity as archived instead of deleting it.
        wait_for : bool, optional
            Whether to wait for the unindexing to refresh.

        Returns
        -------
        DatabaseEntityType
            The deleted or archived entity.
        """
        if soft_delete:
            entity.archived = True
            return await self.save(entity, wait_for)

        self._database_session.delete(entity)
        self._database_session.commit()

        await self._indexer_entity.model_validate(
            entity, from_attributes=True
        ).delete(wait_for=wait_for)

        return entity


# ---------------------------------
# - Protocol shared by all mixins -
# ---------------------------------
class DbIndexedRepositoryContext(
    Protocol[DatabaseEntityType, IndexerModelType]
):
    """
    Protocol for repositories combining database and indexer contexts.

    Attributes
    ----------
    _entity_name : str
        The name of the entity managed by the repository.
    _database_session : DatabaseSession
        The database session used for performing database operations.
    _database_entity : Type[DatabaseEntityType]
        The class type of the database entity.
    _indexer_session : IndexerSession
        The indexer session used for search, scroll, and count operations.
    _indexer_entity : Type[IndexerModelType]
        The index document class used by the repository.
    """

    _entity_name: str
    _database_session: DatabaseSession
    _database_entity: Type[DatabaseEntityType]
    _indexer_session: IndexerSession
    _indexer_entity: Type[IndexerModelType]


# ---------------------
# - Operations mixins -
# ---------------------
class GetByQueryMixin(Generic[DatabaseEntityType, IndexerModelType]):
    """
    Mixin for retrieving entities by running an indexer scroll query.
    """

    async def get_by_query(
        self: DbIndexedRepositoryContext[DatabaseEntityType, IndexerModelType],
        query: IndexerQuery,
    ) -> AsyncGenerator[DatabaseEntityType, None]:
        """
        Yield database entities by running an indexer scroll query.

        Parameters
        ----------
        query : IndexerQuery
            Indexer query body to perform.

        Yields
        ------
        DatabaseEntityType
            Each matching entity found in the database by ID
            from the indexer hits.
        """
        index = self._indexer_entity.ESConfig.index
        id_field = self._indexer_entity.ESConfig.id_field
        db_id_column = getattr(self._database_entity, id_field)

        scroll_id = None

        while True:
            response = (
                await self._indexer_session.scroll(
                    scroll_id=scroll_id, scroll="1m"
                )
                if scroll_id
                else await self._indexer_session.search(
                    index=index, body=query, scroll="1m", fields=[id_field]
                )
            )

            for hit in response["hits"]["hits"]:
                yield self._database_session.query(
                    self._database_entity
                ).filter(db_id_column == hit["_source"][id_field]).one()

            scroll_id = response.get("_scroll_id")
            if not scroll_id or not response["hits"]["hits"]:
                break

        await self._indexer_session.clear_scroll(scroll_id=scroll_id)


class SearchAllMixin(Generic[DatabaseEntityType, IndexerModelType]):
    """
    Mixin for retrieving all matching indexer entities using scroll.
    """

    async def search_all(
        self: DbIndexedRepositoryContext[DatabaseEntityType, IndexerModelType],
        query: IndexerQuery,
    ) -> AsyncGenerator[IndexerModelType, None]:
        """
        Yield all matching indexer entities for a query using scroll.

        Parameters
        ----------
        query : IndexerQuery
            Indexer query for retrieving documents.

        Yields
        ------
        IndexerModelType
            Each parsed document from index results.
        """
        index = self._indexer_entity.ESConfig.index

        scroll_id = None

        while True:
            response = (
                await self._indexer_session.scroll(
                    scroll_id=scroll_id, scroll="1m"
                )
                if scroll_id
                else await self._indexer_session.search(
                    index=index, body=query, scroll="1m"
                )
            )

            for hit in response["hits"]["hits"]:
                yield self._indexer_entity.model_validate(hit["_source"])

            scroll_id = response.get("_scroll_id")
            if not scroll_id or response["hits"]["total"] == 0:
                break

        await self._indexer_session.clear_scroll(scroll_id=scroll_id)


class SearchCountMixin(Generic[DatabaseEntityType, IndexerModelType]):
    """
    Mixin for counting documents matching an indexer query.
    """

    async def count(
        self: DbIndexedRepositoryContext[DatabaseEntityType, IndexerModelType],
        query: IndexerQuery,
    ) -> int:
        """
        Count the number of documents matching the indexer query.

        Parameters
        ----------
        query : IndexerQuery
            Indexer query body to count documents.

        Returns
        -------
        int
            Number of matching documents.
        """

        response = await self._indexer_session.count(
            index=self._indexer_entity.ESConfig.index, body=query
        )
        return response.get("count", 0)
