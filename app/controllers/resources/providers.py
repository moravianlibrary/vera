from typing import Any, Callable, Type, TypeVar

from fastapi import Depends
from fastapi.params import Depends as DependsClass

from adapters.database import DatabaseSession, get_database_session
from adapters.indexer import IndexerSession, get_indexer_session
from repositories._db_indexed_repository import DbIndexedRepository
from repositories._db_repository import DbRepository

RepositoryType = TypeVar("RepositoryType", bound=DbRepository)
ServiceType = TypeVar("ServiceType")


def provide_repository(
    cls: Type[RepositoryType],
) -> Callable[..., RepositoryType]:
    def _resolve_repository(
        db: DatabaseSession = Depends(get_database_session),
        index: IndexerSession = Depends(get_indexer_session),
    ) -> RepositoryType:
        print(
            f"Creating repository instance for {cls.__name__}, {db=}, {index=}"
        )
        if issubclass(cls, DbIndexedRepository):
            return cls(db, index)
        return cls(db)

    return Depends(_resolve_repository)


def provide_service(
    cls: Type[ServiceType], *args: Any
) -> Callable[..., ServiceType]:
    def _resolve_service(*dependencies: Any) -> ServiceType:
        return cls(*dependencies)

    dependency_params = [
        arg if isinstance(arg, DependsClass) else Depends(arg) for arg in args
    ]

    def dependency_factory(*injected: Any) -> ServiceType:
        return _resolve_service(*injected)

    return Depends(
        lambda: dependency_factory(
            *[dep.dependency() for dep in dependency_params]
        )
    )
