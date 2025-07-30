from typing import Any, Callable, Type, TypeVar

from fastapi import Depends

from adapters.database import DatabaseSession, get_database_session
from adapters.indexer import IndexerSession, get_indexer_session
from repositories._base import DbIndexedRepository, DbRepository

RepositoryType = TypeVar("RepositoryType", bound=DbRepository)
ServiceType = TypeVar("ServiceType")


def provide_repository(
    cls: Type[RepositoryType],
) -> Callable[..., RepositoryType]:
    def _resolve_repository(
        db: DatabaseSession = Depends(get_database_session),
        index: IndexerSession = Depends(get_indexer_session),
    ) -> RepositoryType:
        if issubclass(cls, DbIndexedRepository):
            return cls(db, index)
        return cls(db)

    return Depends(_resolve_repository)


def provide_service(
    cls: Type[ServiceType], *args: Any
) -> Callable[..., ServiceType]:
    def _resolve_service() -> ServiceType:
        return cls(*[arg() if callable(arg) else arg for arg in args])

    return Depends(_resolve_service)
