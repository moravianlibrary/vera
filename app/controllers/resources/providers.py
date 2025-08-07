import inspect
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
        if issubclass(cls, DbIndexedRepository):
            return cls(db, index)
        return cls(db)

    return Depends(_resolve_repository)


def provide_service(
    cls: Type[ServiceType], *args: Any
) -> Callable[..., ServiceType]:
    # Wrap each argument in Depends if not already
    dependency_params = [
        arg if isinstance(arg, DependsClass) else Depends(arg) for arg in args
    ]

    # Create the parameter list for FastAPI to inspect
    parameters = [
        inspect.Parameter(
            name=f"dep{i}",
            kind=inspect.Parameter.POSITIONAL_OR_KEYWORD,
            default=dep,
        )
        for i, dep in enumerate(dependency_params)
    ]

    # Create a function that accepts the named parameters
    def _dependency_factory(**kwargs: Any) -> ServiceType:
        # Order injected dependencies by parameter name index (dep0, dep1, ...)
        injected = [kwargs[f"dep{i}"] for i in range(len(dependency_params))]
        return cls(*injected)

    # Attach the signature so FastAPI knows how to inject
    _dependency_factory.__signature__ = inspect.Signature(parameters)

    return Depends(_dependency_factory)
