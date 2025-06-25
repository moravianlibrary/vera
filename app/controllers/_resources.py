from ast import TypeVar
from typing import Any, Callable, Type

from fastapi import Depends, Request

from adapters.database import DatabaseSession, get_database_session
from adapters.identity_provider import AuthScheme, IdentityProvider
from adapters.indexer import IndexerQuery, IndexerSession, get_indexer_session
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
from repositories.notification_list import WatchlistRepository
from repositories.plugin import PluginInstanceRepository, PluginRepository
from repositories.project import ProjectRepository
from repositories.system import (
    SystemHealthRepository,
    SystemSettingsRepository,
    SystemStatusRepository,
)
from repositories.task import (
    ScheduledTaskRepository,
    TaskItemRepository,
    TaskRepository,
)
from schemas.user import AuthenticatedUser
from services import (
    AdditionService,
    CatalogSearchService,
    CategoryService,
    DigiListService,
    DistributionService,
    DocumentService,
)
from services.catalog_record import CatalogRecordService
from services.group import GroupService
from services.intention import IntentionService
from services.project import ProjectService
from services.proposal import ProposalService

DependsOnDatabaseSession = Depends(get_database_session)
DependsOnIndexerSession = Depends(get_indexer_session)


def get_identity_provider(request: Request):
    return request.app.state.identity_provider


DependsOnIdentityProvider = Depends(get_identity_provider)


def get_catalog_adapter(request: Request):
    return request.app.state.catalog_adapter


DependsOnCatalogAdapter = Depends(get_catalog_adapter)


T = TypeVar("T")


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
DependsOnPluginRepository = provide_repository(PluginRepository)
DependsOnPluginInstanceRepository = provide_repository(
    PluginInstanceRepository
)
DependsOnProjectRepository = provide_repository(ProjectRepository, True)
DependsOnProposalRepository = provide_repository(ProposalRepository, True)
DependsOnRoleRepository = provide_repository(RoleRepository)
DependsOnSystemHealthRepository = provide_repository(SystemHealthRepository)
DependsOnSystemSettingsRepository = provide_repository(SystemSettingsRepository)
DependsOnSystemStatusRepository = provide_repository(SystemStatusRepository)
DependsOnTaskRepository = provide_repository(TaskRepository, True)
DependsOnTaskItemRepository = provide_repository(
    TaskItemRepository
)  
DependsOnScheduledTaskRepository = provide_repository(
    ScheduledTaskRepository, True
)
DependsOnUserRepository = provide_repository(UserRepository)
DependsOnWatchlistRepository = provide_repository(
    WatchlistRepository
)


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
DependsOnCatalogRecordService = service_provider(
    CatalogRecordService,
    DependsOnCatalogRecordRepository,
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
DependsOnGroupService = service_provider(
    GroupService,
    DependsOnGroupRepository,
    DependsOnUserRepository,
)
DependsOnIntentionService = service_provider(
    IntentionService, DependsOnIntentionRepository
)
DependsOnPluginService = service_provider(
    PluginRepository,
    DependsOnPluginRepository,
)
DependsOnPluginInstanceService = service_provider(
    PluginInstanceRepository,
    DependsOnPluginRepository,
    DependsOnPluginInstanceRepository,
)
DependsOnProjectService = service_provider(
    ProjectService,
    DependsOnProjectRepository,
    DependsOnGroupRepository,
    DependsOnUserRepository,
)
DependsOnProposalService = service_provider(
    ProposalService,
    DependsOnProposalRepository,
    DependsOnDocumentRepository,
    DependsOnIntentionRepository,
)
DependsOnTaskService = service_provider(
    TaskRepository,
    DependsOnTaskRepository
)
DependsOnScheduledTaskService = service_provider(
    ScheduledTaskRepository,
    DependsOnScheduledTaskRepository,
)


def resolve_authenticated_user(
    token: str = Depends(AuthScheme),
    identity_provider: IdentityProvider = DependsOnIdentityProvider,
    user_repository: UserRepository = DependsOnUserRepository,
    role_repository: RoleRepository = DependsOnRoleRepository,
) -> AuthenticatedUser:
    return identity_provider.authenticate_user(
        token, user_repository, role_repository
    )


DependsOnAuthenticatedUser = Depends(resolve_authenticated_user)


def RestrictedQuery(
    permission: OwnershipPermission,
) -> Callable:
    def get_restricted_query(
        query: IndexerQuery,
        user: AuthenticatedUser = DependsOnAuthenticatedUser,
    ):
        return

    return Depends(get_restricted_query)


def RestrictedSearchRequest(
    permission: OwnershipPermission,
) -> Callable:
    def get_restricted_search_request(
        request: IndexerQuery,
        user: AuthenticatedUser = DependsOnAuthenticatedUser,
    ):
        return request

    return Depends(get_restricted_search_request)


def UserRestrictedQuery() -> Callable:
    def get_scope_restricted_query(
        query: IndexerQuery,
        user: AuthenticatedUser = DependsOnAuthenticatedUser,
    ):
        return query

    return Depends(get_scope_restricted_query)    ):
        return query

    return Depends(get_scope_restricted_query)