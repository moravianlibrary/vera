from typing import Generic, List, Protocol, Type, TypeVar, Union

from pydantic import BaseModel
from sqlalchemy.orm import DeclarativeMeta

from adapters.database import DatabaseSession
from schemas.common import PageParams

# ------------------
# - Type variables -
# ------------------
DatabaseEntity = TypeVar("DatabaseEntity", bound=DeclarativeMeta)
IdType = TypeVar("IdType", bound=Union[str, int])


# ----------------------------
# - Base Database Repository -
# ----------------------------
class DbRepository:
    """
    Base repository providing access to the SQLAlchemy session and model.

    Parameters
    ----------
    entity_name : str
        Descriptive name of the entity (used for error messages).
    database_session : DatabaseSession
        Database session handler.
    database_entity : Type[DatabaseEntity]
        SQLAlchemy model class this repository operates on.
    """

    def __init__(
        self,
        entity_name: str,
        database_session: DatabaseSession,
        database_entity: Type[DatabaseEntity],
    ):
        self._entity_name = entity_name
        self._database_session = database_session
        self._database_entity = database_entity


# ---------------------------------
# - Protocol shared by all mixins -
# ---------------------------------
class DbRepositoryContext(Protocol[DatabaseEntity]):
    _entity_name: str
    _database_session: DatabaseSession
    _database_entity: Type[DatabaseEntity]


# ---------------------
# - Operations mixins -
# ---------------------
class FindByIdMixin(Generic[DatabaseEntity, IdType]):
    """
    Mixin for retrieving a single entity by its ID.
    """

    def find_by_id(
        self: DbRepositoryContext[DatabaseEntity], entity_id: IdType
    ) -> DatabaseEntity | None:
        """
        Fetch a single entity by its ID.

        Parameters
        ----------
        entity_id : IdType
            The primary key of the entity.

        Returns
        -------
        DatabaseEntity | None
            The entity if found, otherwise None.
        """
        return (
            self._database_session.query(self._database_entity)
            .filter(self._database_entity.id == entity_id)
            .first()
        )


class FindByNameMixin(Generic[DatabaseEntity]):
    """
    Mixin for retrieving a single entity by its name.
    """

    def find_by_name(
        self: DbRepositoryContext[DatabaseEntity], name: str
    ) -> DatabaseEntity | None:
        """
        Fetch a single entity by its name.

        Parameters
        ----------
        name : str
            The name of the entity.

        Returns
        -------
        DatabaseEntity | None
            The entity if found, otherwise None.
        """
        return (
            self._database_session.query(self._database_entity)
            .filter(self._database_entity.name == name)
            .first()
        )


class FindByNamesMixin(Generic[DatabaseEntity]):
    """
    Mixin for retrieving multiple entities by a list of names.
    """

    def find_by_names(
        self: DbRepositoryContext[DatabaseEntity], names: List[str]
    ) -> List[DatabaseEntity]:
        """
        Fetch multiple entities by a list of names.

        Parameters
        ----------
        names : List[str]
            A list of entity names.

        Returns
        -------
        List[DatabaseEntity]
            A list of matched entities.
        """
        return (
            self._database_session.query(self._database_entity)
            .filter(self._database_entity.name.in_(names))
            .all()
        )


class GetByIdMixin(Generic[DatabaseEntity, IdType]):
    """
    Mixin for strictly retrieving a single entity by ID,
    raising error if not found.
    """

    def get_by_id(
        self: DbRepositoryContext[DatabaseEntity], entity_id: IdType
    ) -> DatabaseEntity:
        """
        Fetch a single entity by its ID or raise an error if not found.

        Parameters
        ----------
        entity_id : Union[str, int]
            The primary key of the entity.

        Returns
        -------
        DatabaseEntity
            The found entity.

        Raises
        ------
        ValueError
            If the entity with the given ID does not exist.
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
    """
    Mixin for retrieving multiple entities by a list of IDs.
    """

    def get_by_ids(
        self: DbRepositoryContext[DatabaseEntity], entity_ids: List[IdType]
    ) -> List[DatabaseEntity]:
        """
        Fetch multiple entities by their IDs.

        Parameters
        ----------
        entity_ids : List[Union[str, int]]
            List of entity primary keys.

        Returns
        -------
        List[DatabaseEntity]
            List of found entities.
        """
        return (
            self._database_session.query(self._database_entity)
            .filter(self._database_entity.id.in_(entity_ids))
            .all()
        )


class PaginationMixin(Generic[DatabaseEntity]):
    """
    Mixin providing paginated listing of entities with optional filtering.
    """

    def paginate(
        self: DbRepositoryContext[DatabaseEntity],
        page_params: PageParams,
        filter_params: BaseModel | None = None,
    ) -> List[DatabaseEntity]:
        """
        Return a paginated list of entities.

        Parameters
        ----------
        page_params : PageParams
            Pagination parameters (offset, limit).
        filter_params : BaseModel, optional
            Optional filter criteria as a Pydantic model.

        Returns
        -------
        List[DatabaseEntity]
            Paginated and optionally filtered results.
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
    """
    Mixin to ensure entity names are unique across the table.
    """

    def enforce_name_uniqueness(
        self: DbRepositoryContext[DatabaseEntity],
        name: str,
        entity_id: IdType | None = None,
    ) -> None:
        """
        Raise an error if another entity with the same name exists.

        Parameters
        ----------
        name : str
            The name to check.
        entity_id : Union[str, int], optional
            ID to exclude from uniqueness check (for updates).

        Raises
        ------
        ValueError
            If another entity with the same name exists.
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
    """
    Mixin for saving (inserting or updating) an entity.
    """

    def save(
        self: DbRepositoryContext[DatabaseEntity], entity: DatabaseEntity
    ) -> DatabaseEntity:
        """
        Persist the entity to the database.

        Parameters
        ----------
        entity : DatabaseEntity
            The entity to save.

        Returns
        -------
        DatabaseEntity
            The saved entity with refreshed state.
        """
        self._database_session.add(entity)
        self._database_session.commit()
        self._database_session.refresh(entity)
        return entity


class DeleteMixin(Generic[DatabaseEntity]):
    """
    Mixin for deleting an entity from the database.
    """

    def delete(
        self: DbRepositoryContext[DatabaseEntity], entity: DatabaseEntity
    ) -> DatabaseEntity:
        """
        Permanently delete the entity from the database.

        Parameters
        ----------
        entity : DatabaseEntity
            The entity to delete.

        Returns
        -------
        DatabaseEntity
            The deleted entity (now detached).
        """
        self._database_session.delete(entity)
        self._database_session.commit()
        return entity


class ArchiveOnDeleteMixin(Generic[DatabaseEntity]):
    """
    Mixin to soft-delete an entity by marking it as archived.
    """

    def delete(
        self: DbRepositoryContext[DatabaseEntity], entity: DatabaseEntity
    ) -> DatabaseEntity:
        """
        Mark the entity as archived instead of deleting it.

        Parameters
        ----------
        entity : DatabaseEntity
            The entity to archive.

        Returns
        -------
        DatabaseEntity
            The archived entity.
        """
        entity.archived = True
        self._database_session.commit()
        self._database_session.refresh(entity)
        return entity
