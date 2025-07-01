from functools import wraps
from typing import Any, Callable

from sqlalchemy import create_engine
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
    pass


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
