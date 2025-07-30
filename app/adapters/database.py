from functools import wraps
from typing import Any, Callable

from sqlalchemy import Column, ForeignKey, Table, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from config import VeraConfig

DatabaseSession = Session

DatabaseUrl = (
    f"postgresql://"
    f"{VeraConfig.Postgres.User}:{VeraConfig.Postgres.Password}"
    f"@{VeraConfig.Postgres.Host}:{VeraConfig.Postgres.Port}"
    f"/{VeraConfig.Postgres.DatabaseName}"
)

DatabaseEngine = create_engine(
    url=DatabaseUrl,
    pool_size=VeraConfig.Postgres.PoolSize,
    max_overflow=VeraConfig.Postgres.MaxOverflow,
    pool_timeout=VeraConfig.Postgres.PoolTimeout,
    pool_recycle=VeraConfig.Postgres.PoolRecycle,
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
