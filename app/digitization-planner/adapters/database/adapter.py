from functools import wraps
from typing import Any, Callable

from config import VeraConfig
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import DeclarativeMeta, declarative_base
from sqlalchemy.orm import sessionmaker

DatabaseUrl = (
    f"postgresql://"
    f"{VeraConfig.Postgres.User}:{VeraConfig.Postgres.Password}"
    f"@{VeraConfig.Postgres.Host}:{VeraConfig.Postgres.Port}"
    f"/{VeraConfig.Postgres.DatabaseName}"
)

Engine = create_engine(
    url=DatabaseUrl,
    pool_size=VeraConfig.Postgres.PoolSize,
    max_overflow=VeraConfig.Postgres.MaxOverflow,
    pool_timeout=VeraConfig.Postgres.PoolTimeout,
    pool_recycle=VeraConfig.Postgres.PoolRecycle,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=Engine)

BaseModel: DeclarativeMeta = declarative_base()


def get_db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def with_db_session(func: Callable) -> Callable:
    @wraps(func)
    def wrapper(*args, **kwargs) -> Any:
        db_session = SessionLocal()
        try:
            return func(db_session, *args, **kwargs)
        finally:
            db_session.close()

    return wrapper
