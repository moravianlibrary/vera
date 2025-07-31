from typing import Generic, List, Protocol, Type, TypeVar, Union

from pydantic import BaseModel
from sqlalchemy.orm import DeclarativeMeta

from adapters.database import DatabaseSession
from schemas.common import PageParams

# ------------------
# - Type variables -
# ------------------
IdType = TypeVar("IdType", bound=Union[str, int])
DatabaseEntityType = TypeVar("DatabaseEntityType", bound=DeclarativeMeta)


# ----------------------------
# - Base Database Repository -
# ----------------------------
class DbRepository(Generic[DatabaseEntityType]):
    """
    Base repository providing access to the SQLAlchemy session and model.

    Parameters
    ----------
    entity_name : str
        Descriptive name of the entity (used for error messages).
    database_session : DatabaseSession
        Database session handler.
    database_entity : Type[DatabaseEntityType]
        SQLAlchemy model class this repository operates on.
    """

    def __init__(
        self,
        entity_name: str,
        database_session: DatabaseSession,
        database_entity: Type[DatabaseEntityType],
    ):
        self._entity_name = entity_name
        self._database_session = database_session
        self._database_entity = database_entity

    def save(self, entity: DatabaseEntityType) -> DatabaseEntityType:
        """
        Persist the entity to the database.

        Parameters
        ----------
        entity : DatabaseEntityType
            The entity to save.

        Returns
        -------
        DatabaseEntityType
            The saved entity with refreshed state.
        """
        self._database_session.add(entity)
        self._database_session.commit()
        self._database_session.refresh(entity)
        return entity

    def delete(
        self, entity: DatabaseEntityType, soft_delete: bool = False
    ) -> DatabaseEntityType:
        """
        Delete the entity from the database.

        Parameters
        ----------
        entity : DatabaseEntityType
            The entity to delete.
        soft_delete : bool, default=False
            If True, mark the entity as archived instead of deleting it.

        Returns
        -------
        DatabaseEntityType
            The deleted (or archived) entity.
        """
        if soft_delete:
            entity.archived = True
            return self.save(entity)

        self._database_session.delete(entity)
        self._database_session.commit()
        return entity


# ---------------------------------
# - Protocol shared by all mixins -
# ---------------------------------
class DbRepositoryContext(Protocol[DatabaseEntityType]):
    """
    Protocol defining the required context attributes
    for a database repository.

    Attributes
    ----------
    _entity_name : str
        The name of the entity managed by the repository.
    _database_session : DatabaseSession
        The database session used for performing database operations.
    _database_entity : Type[DatabaseEntityType]
        The class type of the database entity (e.g., SQLAlchemy model)
        managed by the repository.
    """

    _entity_name: str
    _database_session: DatabaseSession
    _database_entity: Type[DatabaseEntityType]


# ---------------------
# - Operations mixins -
# ---------------------
class FindByIdMixin(Generic[DatabaseEntityType, IdType]):
    """
    Mixin for retrieving a single entity by its ID.
    """

    def find_by_id(
        self: DbRepositoryContext[DatabaseEntityType], entity_id: IdType
    ) -> DatabaseEntityType | None:
        """
        Fetch a single entity by its ID.

        Parameters
        ----------
        entity_id : IdType
            The primary key of the entity.

        Returns
        -------
        DatabaseEntityType | None
            The entity if found, otherwise None.
        """
        return (
            self._database_session.query(self._database_entity)
            .filter(self._database_entity.id == entity_id)
            .first()
        )


class FindByNameMixin(Generic[DatabaseEntityType]):
    """
    Mixin for retrieving a single entity by its name.
    """

    def find_by_name(
        self: DbRepositoryContext[DatabaseEntityType], name: str
    ) -> DatabaseEntityType | None:
        """
        Fetch a single entity by its name.

        Parameters
        ----------
        name : str
            The name of the entity.

        Returns
        -------
        DatabaseEntityType | None
            The entity if found, otherwise None.
        """
        return (
            self._database_session.query(self._database_entity)
            .filter(self._database_entity.name == name)
            .first()
        )


class FindByNamesMixin(Generic[DatabaseEntityType]):
    """
    Mixin for retrieving multiple entities by a list of names.
    """

    def find_by_names(
        self: DbRepositoryContext[DatabaseEntityType], names: List[str]
    ) -> List[DatabaseEntityType]:
        """
        Fetch multiple entities by a list of names.

        Parameters
        ----------
        names : List[str]
            A list of entity names.

        Returns
        -------
        List[DatabaseEntityType]
            A list of matched entities.
        """
        return (
            self._database_session.query(self._database_entity)
            .filter(self._database_entity.name.in_(names))
            .all()
        )


class GetByIdMixin(Generic[DatabaseEntityType, IdType]):
    """
    Mixin for strictly retrieving a single entity by ID,
    raising error if not found.
    """

    def get_by_id(
        self: DbRepositoryContext[DatabaseEntityType], entity_id: IdType
    ) -> DatabaseEntityType:
        """
        Fetch a single entity by its ID or raise an error if not found.

        Parameters
        ----------
        entity_id : Union[str, int]
            The primary key of the entity.

        Returns
        -------
        DatabaseEntityType
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


class GetByIdsMixin(Generic[DatabaseEntityType, IdType]):
    """
    Mixin for retrieving multiple entities by a list of IDs.
    """

    def get_by_ids(
        self: DbRepositoryContext[DatabaseEntityType], entity_ids: List[IdType]
    ) -> List[DatabaseEntityType]:
        """
        Fetch multiple entities by their IDs.

        Parameters
        ----------
        entity_ids : List[Union[str, int]]
            List of entity primary keys.

        Returns
        -------
        List[DatabaseEntityType]
            List of found entities.
        """
        return (
            self._database_session.query(self._database_entity)
            .filter(self._database_entity.id.in_(entity_ids))
            .all()
        )


class PaginationMixin(Generic[DatabaseEntityType]):
    """
    Mixin providing paginated listing of entities with optional filtering.
    """

    def paginate(
        self: DbRepositoryContext[DatabaseEntityType],
        page_params: PageParams,
        filter_params: BaseModel | None = None,
    ) -> List[DatabaseEntityType]:
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
        List[DatabaseEntityType]
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


class EnforceNameUniquenessMixin(Generic[DatabaseEntityType, IdType]):
    """
    Mixin to ensure entity names are unique across the table.
    """

    def enforce_name_uniqueness(
        self: DbRepositoryContext[DatabaseEntityType],
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
