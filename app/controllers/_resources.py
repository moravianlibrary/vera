from ast import TypeVar
from typing import Any, Callable, Type

from fastapi import Depends, Request

from adapters.database import DatabaseSession, get_database_session
from adapters.indexer import IndexerQuery, IndexerSession, get_indexer_session
from controllers._security import DependsOnAuthenticatedUser
from definitions.permission import OwnershipPermission
from repositories import (
    AdditionRepository,
    CategoryRepository,
    DigiListRepository,
    DistributionRepository,
    DocumentRepository,
    GroupRepository,
    IntentionRepository,
    ProposalRepository,
    RoleRepository,
    UserRepository,
)
from repositories.catalog_record import CatalogRecordRepository
from schemas.user import AuthenticatedUser
from services import (
    AdditionService,
    CatalogSearchService,
    CategoryService,
    DigiListService,
    DistributionService,
    DocumentService,
)

DependsOnDatabaseSession = Depends(get_database_session)
DependsOnIndexerSession = Depends(get_indexer_session)


def get_identity_provider(request: Request):
    return request.app.state.identity_provider


DependsOnIdentityProvider = Depends(get_identity_provider)


def get_catalog_adapter(request: Request):
    return request.app.state.catalog_adapter


DependsOnCatalogAdapter = Depends(get_catalog_adapter)


T = TypeVar["T"]


def provide_repository(
    cls: Type[T], with_indexer: bool = False
) -> Callable[..., T]:
    def dependency(
        db_session: DatabaseSession = Depends(get_database_session),
        indexer_session: IndexerSession = Depends(get_indexer_session),
    ) -> T:
        return (
            cls(db_session, indexer_session)
            if with_indexer
            else cls(db_session)
        )

    return Depends(dependency)


DependsOnAdditionRepository = provide_repository(AdditionRepository, True)
DependsOnCatalogRecordRepository = provide_repository(
    CatalogRecordRepository, True
)
DependsOnCategoryRepository = provide_repository(CategoryRepository, True)
DependsOnDigiListRepository = provide_repository(DigiListRepository, True)
DependsOnDistributionRepository = provide_repository(DistributionRepository)
DependsOnDocumentRepository = provide_repository(DocumentRepository, True)
DependsOnGroupRepository = provide_repository(GroupRepository)
DependsOnIntentionRepository = provide_repository(IntentionRepository, True)
DependsOnProposalRepository = provide_repository(ProposalRepository, True)
DependsOnRoleRepository = provide_repository(RoleRepository)
DependsOnUserRepository = provide_repository(UserRepository)


def service_provider(
    service_cls: Type[T], *dependencies: Any
) -> Callable[..., T]:
    def _provider() -> T:
        return service_cls(
            *[dep() if callable(dep) else dep for dep in dependencies]
        )

    return Depends(_provider)


DependsOnAdditionService = service_provider(
    AdditionService, DependsOnAdditionRepository
)
DependsOnCatalogSearchService = service_provider(
    CatalogSearchService,
    DependsOnCatalogAdapter,
    DependsOnCatalogRecordRepository,
)
DependsOnCategoryService = service_provider(
    CategoryService, DependsOnCategoryRepository
)
DependsOnDigiListService = service_provider(
    DigiListService,
    DependsOnDigiListRepository,
    DependsOnDocumentRepository,
    DependsOnIntentionRepository,
)
DependsOnDistributionService = service_provider(
    DistributionService,
    DependsOnDistributionRepository,
    DependsOnCategoryRepository,
)
DependsOnDocumentService = service_provider(
    DocumentService,
    DependsOnDocumentRepository,
)
DependsOnProposalService = service_provider(
    ProposalRepository,
    DependsOnProposalRepository,
    DependsOnDocumentRepository,
    DependsOnIntentionRepository,
)


def RestrictedQuery(
    permission: OwnershipPermission,
) -> Callable:
    def get_restricted_query(
        query: IndexerQuery,
        user: AuthenticatedUser = DependsOnAuthenticatedUser,
    ):
        return

    return Depends(get_restricted_query)


def UserRestrictedQuery() -> Callable:
    def get_scope_restricted_query(
        query: IndexerQuery,
        user: AuthenticatedUser = DependsOnAuthenticatedUser,
    ):
        return query

    return Depends(get_scope_restricted_query)
