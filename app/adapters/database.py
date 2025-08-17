from typing import Any, Callable, Dict, Generator, List, Type, TypeVar

from sqlalchemy import Column, ForeignKey, Table, create_engine
from sqlalchemy.orm import (
    DeclarativeBase,
    DeclarativeMeta,
    Session,
    relationship,
    sessionmaker,
)
from sqlalchemy.orm.relationships import _ORMColCollectionArgument

from config import config

DatabaseSession = Session

DatabaseUrl = (
    f"postgresql://"
    f"{config.postgres.user}:{config.postgres.password}"
    f"@{config.postgres.host}:{config.postgres.port}"
    f"/{config.postgres.database_name}"
)

DatabaseEngine = create_engine(
    url=DatabaseUrl,
    pool_size=config.postgres.pool_size,
    max_overflow=config.postgres.max_overflow,
    pool_timeout=config.postgres.pool_timeout,
    pool_recycle=config.postgres.pool_recycle,
    pool_pre_ping=True,
)

DatabaseSessionFactory = sessionmaker(
    autocommit=False, autoflush=False, bind=DatabaseEngine
)


DatabaseEntityType = TypeVar("DatabaseEntityType", bound=DeclarativeMeta)


def db_view(func: Callable) -> Callable:
    """
    Marks a model method as a database view that returns a dict.
    """
    func._is_db_view = True
    return func


class BaseModel(DeclarativeBase):
    __abstract__ = True

    def collect_views(
        self, db_session: DatabaseSession
    ) -> List[Dict[str, Any]]:
        """
        Collects all dicts from methods marked with @db_view on the entity.
        """
        views = []
        for attr_name in dir(self):
            attr = getattr(self, attr_name)
            if callable(attr) and getattr(attr, "_is_db_view", False):
                views.append(attr(db_session))
        return views


PydanticModel = TypeVar("T", bound="BaseModel")


class ModelValidateWithViewsMixin:
    @classmethod
    def model_validate_with_views(
        cls: Type[PydanticModel],
        db_entity: DatabaseEntityType,
        views: List[Dict[str, Any]] | None = None,
    ) -> PydanticModel:
        """
        Validate a model from an database object
        and combine with extra dicts or keyword args.

        Parameters
        ----------
        db_entity : DatabaseEntityType
            Database object with attributes matching model fields.
        views : List[Dict[str, Any]] | None
            List of view dictionaries to merge into the model data.

        Returns
        -------
        PydanticModel
            Validated Pydantic model instance.
        """
        data = {
            field_name: getattr(db_entity, field_name)
            for field_name in cls.model_fields
            if hasattr(db_entity, field_name)
        }

        for view in views or []:
            data.update(view)

        return cls.model_validate(data, from_attributes=True)


def AssociationTable(
    left_entity_name: str,
    right_entity_name: str,
    left_key: str | None = None,
    right_key: str | None = None,
    left_fk: str | None = None,
    right_fk: str | None = None,
) -> Table:
    return Table(
        f"{left_entity_name}_{right_entity_name}_association",
        BaseModel.metadata,
        Column(
            left_key or f"{left_entity_name}_id",
            ForeignKey(left_fk or f"{left_entity_name}s.id"),
            primary_key=True,
        ),
        Column(
            right_key or f"{right_entity_name}_id",
            ForeignKey(right_fk or f"{right_entity_name}s.id"),
            primary_key=True,
        ),
    )


def contains(target: str, back_populates: str, lazy: str = "selectin") -> Any:
    """
    One-to-many relationship where the parent contains the children.
    Children are deleted if orphaned.
    """
    return relationship(
        target,
        back_populates=back_populates,
        lazy=lazy,
        cascade="all, delete-orphan",
        uselist=True,
    )


def belongs_to(
    target: str,
    back_populates: str,
    lazy: str = "select",
    remote_side: _ORMColCollectionArgument | None = None,
) -> Any:
    """
    Many-to-one relationship: this entity belongs to another.
    """
    return relationship(
        target,
        back_populates=back_populates,
        lazy=lazy,
        remote_side=remote_side,
        uselist=False,
    )


def has_one(target: str, back_populates: str, lazy: str = "select") -> Any:
    """
    One-to-one or many-to-one relationship
    where this entity has one of another.
    """
    return relationship(
        target,
        back_populates=back_populates,
        lazy=lazy,
        uselist=False,
    )


def has_many(target: str, back_populates: str, lazy: str = "selectin") -> Any:
    """
    One-to-many relationship where this entity has many of another.
    """
    return relationship(
        target,
        back_populates=back_populates,
        lazy=lazy,
        uselist=True,
    )


def connected_with(
    target: str,
    secondary: Any,
    back_populates: str,
    lazy: str = "selectin",
) -> Any:
    """
    Many-to-many relationship using an association table.
    """
    return relationship(
        target,
        secondary=secondary,
        back_populates=back_populates,
        lazy=lazy,
        uselist=True,
    )


def get_database_session() -> Generator[DatabaseSession, None, None]:
    session = DatabaseSessionFactory()
    try:
        yield session
    finally:
        session.close()
