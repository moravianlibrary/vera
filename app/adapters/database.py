from functools import wraps
from typing import Any, Callable

from sqlalchemy import Column, ForeignKey, Table, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker
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


class BaseModel(DeclarativeBase):
    __abstract__ = True


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


def contains(target: str, back_populates: str, lazy: str = "joined") -> Any:
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
    lazy: str = "joined",
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


def has_one(target: str, back_populates: str, lazy: str = "joined") -> Any:
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


def has_many(target: str, back_populates: str, lazy: str = "joined") -> Any:
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
    lazy: str = "select",
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


def get_database_session():
    session = DatabaseSessionFactory()
    try:
        yield session
    finally:
        session.close()


def with_database_session(func: Callable) -> Callable:
    @wraps(func)
    def wrapper(*args, **kwargs) -> Any:
        db_session = DatabaseSessionFactory()
        try:
            return func(db_session, *args, **kwargs)
        finally:
            db_session.close()

    return wrapper
