from dataclasses import dataclass
from typing import Generic, List, Protocol, Type, TypeVar, Union

from adapters.database import BaseModel, DatabaseEntityType, DatabaseSession
from config import config
from errors.common import EntityNotFoundError
from repositories.models.mixins.notification import NotificationMixin
from schemas.common import PageParams

# ------------------
# - Type variables -
# ------------------
IdType = TypeVar("IdType", bound=Union[str, int])


@dataclass
class PaginatedResult(Generic[DatabaseEntityType]):
    items: List[DatabaseEntityType]
    num_found: int


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
    database_entity : Type[DatabaseEntityType]
        SQLAlchemy model class this repository operates on.
    database_session : DatabaseSession
        Database session handler.
    """

    _entity_name: str = "Change me"
    _db_model: Type[DatabaseEntityType] = BaseModel

    def __init__(self, database_session: DatabaseSession):
        self._database_session = database_session

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
    _db_model : Type[DatabaseEntityType]
        The class type of the database entity (e.g., SQLAlchemy model)
        managed by the repository.
    """

    _entity_name: str
    _database_session: DatabaseSession
    _db_model: Type[DatabaseEntityType]


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
            self._database_session.query(self._db_model)
            .filter(self._db_model.id == entity_id)
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
            self._database_session.query(self._db_model)
            .filter(self._db_model.name == name)
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
            self._database_session.query(self._db_model)
            .filter(self._db_model.name.in_(names))
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
            self._database_session.query(self._db_model)
            .filter(self._db_model.id == entity_id)
            .first()
        )

        if not entity:
            raise EntityNotFoundError(self._entity_name, entity_id)

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

        Raises
        ------
        EntityNotFoundError
            If any of the requested IDs were not found.
        """
        results = (
            self._database_session.query(self._db_model)
            .filter(self._db_model.id.in_(entity_ids))
            .all()
        )

        if len(results) == len(entity_ids):
            return results

        found_ids = {getattr(r, "id") for r in results}
        missing_ids = set(entity_ids) - found_ids

        # TODO: Use http exception
        raise ValueError(f"Entities with IDs {missing_ids} not found.")


class PaginationMixin(Generic[DatabaseEntityType]):
    """
    Mixin providing paginated listing of entities with optional filtering.
    """

    def paginate(
        self: DbRepositoryContext[DatabaseEntityType],
        page_params: PageParams,
        filter_params: BaseModel | None = None,
    ) -> PaginatedResult[DatabaseEntityType]:
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
        query = self._database_session.query(self._db_model)

        if filter_params:
            query = query.filter_by(
                **filter_params.model_dump(exclude_unset=True)
            )

        return PaginatedResult(
            items=query.order_by(self._db_model.id)
            .offset(page_params.offset)
            .limit(page_params.limit)
            .all(),
            num_found=query.count(),
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
        query = self._database_session.query(self._db_model).filter(
            self._db_model.name == name
        )
        if entity_id:
            query = query.filter(self._db_model.id != entity_id)
        if query.first() is not None:
            # TODO: Use a custom exception
            raise ValueError(
                f"{self._entity_name} with the name '{name}' already exists"
            )


NotificationEntityType = TypeVar(
    "NotificationEntityType", bound=NotificationMixin
)


class NotificationOperationsMixin(Generic[NotificationEntityType, IdType]):
    """
    Mixin providing common operations for notification entities.
    """

    def get_unread_count(
        self: DbRepositoryContext[NotificationEntityType], user_id: str
    ) -> int:
        """
        Count the number of unread notifications for the specified user.

        Parameters
        ----------
        user_id : str
            The ID of the user.

        Returns
        -------
        int
            The count of unread notifications for the user.
        """
        return (
            self._database_session.query(self._db_model)
            .filter(
                self._db_model.user_id == user_id,
                self._db_model.read_at.is_(None),
            )
            .count()
        )

    def get_unpushed(
        self: DbRepositoryContext[NotificationEntityType], user_id: str
    ) -> List[NotificationEntityType]:
        """
        Retrieve up to n (defined in system settings) unpushed notifications
        for the specified user. Then mark all unpushed notifications as pushed.

        Parameters
        ----------
        user_id : str
            The ID of the user.

        Returns
        -------
        List[NotificationEntityType]
            List of unpushed notifications for the user.
        """
        notifications = (
            self._database_session.query(self._db_model)
            .filter(
                self._db_model.user_id == user_id,
                self._db_model.push_sent.is_(False),
            )
            .order_by(self._db_model.created_at.desc())
            .limit(10)  # TODO: from system settings
            .all()
        )

        self._database_session.query(self._db_model).filter(
            self._db_model.user_id == user_id,
            self._db_model.push_sent.is_(False),
        ).update({self._db_model.push_sent: True})
        self._database_session.commit()

        return notifications

    def mark_as_read(
        self: DbRepositoryContext[NotificationEntityType],
        notification: NotificationEntityType,
    ) -> NotificationEntityType:
        """
        Mark the specified notification as read.

        Parameters
        ----------
        notification : NotificationEntityType
            The notification to mark as read.

        Returns
        -------
        NotificationEntityType
            The updated notification.
        """
        notification.read_at = config.timestamp

        return self.save(notification)

    def mark_all_as_read(
        self: DbRepositoryContext[NotificationEntityType], user_id: str
    ) -> int:
        """
        Mark all notifications for the specified user as read.

        Parameters
        ----------
        user_id : str
            The ID of the user.

        Returns
        -------
        int
            The number of notifications marked as read.
        """
        updated_count = (
            self._database_session.query(self._db_model)
            .filter(
                self._db_model.user_id == user_id,
                self._db_model.read_at.is_(None),
            )
            .update({self._db_model.read_at: config.timestamp})
        )
        self._database_session.commit()

        return updated_count
