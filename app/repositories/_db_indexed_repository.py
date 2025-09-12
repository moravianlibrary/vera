import asyncio
from typing import AsyncGenerator, Generic, List, Protocol, Type

from elasticsearch.helpers import async_bulk
from esorm import setup_mappings

from adapters.database import DatabaseSession
from adapters.indexer import (
    IndexerModelType,
    IndexerQuery,
    IndexerRequest,
    IndexerResponse,
    IndexerSession,
)
from definitions.json import JsonObject

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

    _indexer_model: Type[IndexerModelType]
    _wait_for_index_refresh: bool = False

    def __init__(
        self,
        database_session: DatabaseSession,
        indexer_session: IndexerSession,
    ):
        super().__init__(database_session)
        self._indexer_session = indexer_session
        self._index = self._indexer_model.ESConfig.index
        self._id_field = self._indexer_model.ESConfig.id_field

    def has_current_version_schema(self) -> bool:
        """
        Check if the current index mapping schema matches the entity's version.

        Returns
        -------
        bool
            True if the index schema matches the expected version;
            False otherwise.
        """
        mapping = self._indexer_session.indices.get_mapping(
            index=self._index
        ).get(self._index, {})

        return mapping.get("mappings", {}).get("_meta", {}).get(
            "index.version"
        ) == getattr(self._indexer_model.ESConfig, "version", None)

    async def recreate_index(self):
        """
        Delete and recreate the index
        using the schema defined by the indexer entity.
        """
        if self._indexer_session.indices.exists(index=self._index):
            self._indexer_session.indices.delete(index=self._index)

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
        return (
            await self._indexer_session.search(
                index=self._index, body=request.model_dump()
            )
        ).body

    def serialize_entity(
        self, db_entity: DatabaseEntityType
    ) -> IndexerModelType:
        """
        Serialize a database entity to its indexer model representation.

        Parameters
        ----------
        entity : DatabaseEntityType
            The database entity to serialize.

        Returns
        -------
        IndexerModelType
            The serialized indexer model.
        """
        if hasattr(self._indexer_model, "model_validate_with_views"):
            views = db_entity.collect_views(self._database_session)
            return self._indexer_model.model_validate_with_views(
                db_entity, views
            )
        else:
            return self._indexer_model.model_validate(
                db_entity, from_attributes=True
            )

    async def index(
        self, entity: DatabaseEntityType, wait_for: bool = False
    ) -> None:
        """
        Index a database entity.

        Parameters
        ----------
        entity : DatabaseEntityType
            The database entity to index.
        wait_for: bool, optional
            Whether to wait for the indexing to refresh.
        """
        await self._indexer_session.index(
            index=self._index,
            id=entity.id,
            body=self.serialize_entity(entity).model_dump(
                mode="json", exclude={self._id_field}, exclude_none=True
            ),
            refresh=(
                "wait_for"
                if self._wait_for_index_refresh or wait_for
                else None
            ),
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

        await self.index(entity, wait_for)

        return entity

    async def index_bulk(
        self, entities: List[DatabaseEntityType], wait_for: bool = False
    ) -> None:
        """
        Index multiple database entities in bulk.

        Parameters
        ----------
        entities : List[DatabaseEntityType]
            The database entities to index.
        """
        docs = []
        for entity in entities:
            docs.append(self.serialize_entity(entity))

        _, errors = await async_bulk(
            self._indexer_session,
            (
                {
                    "_op_type": "index",
                    "_index": self._index,
                    "_id": doc.__id__,
                    "_source": doc.model_dump(
                        mode="json",
                        exclude={self._id_field},
                        exclude_none=True,
                    ),
                }
                for doc in docs
            ),
            refresh=(
                "wait_for"
                if self._wait_for_index_refresh or wait_for
                else None
            ),
        )

        if errors:
            raise RuntimeError(f"Failed to index some documents: {errors}")

    async def save_bulk(
        self,
        entities: List[DatabaseEntityType],
        wait_for: bool = False,
    ) -> List[DatabaseEntityType]:
        self._database_session.add_all(entities)
        self._database_session.commit()
        for entity in entities:
            self._database_session.refresh(entity)

        await self.index_bulk(entities, wait_for)

        return entities

    # TODO:
    async def index_all(self) -> None:
        semaphore = asyncio.BoundedSemaphore(10)

        async def save_entity(entity):
            async with semaphore:
                await self.serialize_entity(entity).save()

        entities = self._database_session.query(self._db_model).yield_per(1000)

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

        await self.serialize_entity(entity).delete(
            wait_for=self._wait_for_index_refresh or wait_for
        )

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
    _db_model : Type[DatabaseEntityType]
        The class type of the database entity.
    _indexer_session : IndexerSession
        The indexer session used for search, scroll, and count operations.
    _indexer_model : Type[IndexerModelType]
        The index document class used by the repository.
    """

    _entity_name: str
    _database_session: DatabaseSession
    _db_model: Type[DatabaseEntityType]
    _indexer_session: IndexerSession
    _indexer_model: Type[IndexerModelType]
    _index: str
    _id_field: str


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
        db_id_column = getattr(self._db_model, self._id_field)

        scroll_id = None

        while True:
            response = (
                await self._indexer_session.scroll(
                    scroll_id=scroll_id, scroll="1m"
                )
                if scroll_id
                else await self._indexer_session.search(
                    index=self._index,
                    body=query,
                    scroll="1m",
                    fields=[self._id_field],
                )
            )

            for hit in response["hits"]["hits"]:
                yield self._database_session.query(self._db_model).filter(
                    db_id_column == hit["_source"][self._id_field]
                ).one()

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
    ) -> AsyncGenerator[JsonObject, None]:
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
        index = self._indexer_model.ESConfig.index
        scroll_id = None

        try:
            while True:
                response = (
                    await self._indexer_session.scroll(
                        scroll_id=scroll_id, scroll="1m"
                    )
                    if scroll_id
                    else await self._indexer_session.search(
                        index=index,
                        body=query.model_dump(mode="json"),
                        scroll="1m",
                    )
                )

                hits = response["hits"]["hits"]
                if not hits:
                    break

                for hit in hits:
                    yield hit["_source"]

                scroll_id = response.get("_scroll_id")

        finally:
            if scroll_id:
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
            index=self._index, body=query
        )
        return response.get("count", 0)
