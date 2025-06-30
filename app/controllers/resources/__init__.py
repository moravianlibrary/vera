from fastapi import Depends

from adapters.database import get_database_session
from adapters.indexer import get_indexer_session
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
from repositories.watchlist import WatchlistRepository
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
from services.task import ScheduledTaskService, TaskService
from vera_state import get_catalog_adapter, get_identity_provider

from .providers import provide_repository, provide_service
from .resolvers import resolve_authenticated_user, resolve_schedule_params
from .restricted import (
    get_restricted_filter_params,
    get_restricted_params,
    get_restricted_query,
    get_restricted_search,
)
from .security import enforce_ownership, require_permission

DependsOnDatabaseSession = Depends(get_database_session)
DependsOnIndexerSession = Depends(get_indexer_session)

DependsOnCatalogAdapter = Depends(get_catalog_adapter)
DependsOnIdentityProvider = Depends(get_identity_provider)

DependsOnAdditionRepository = provide_repository(AdditionRepository)
DependsOnCatalogRecordRepository = provide_repository(CatalogRecordRepository)
DependsOnCategoryRepository = provide_repository(CategoryRepository)
DependsOnDigiListRepository = provide_repository(DigiListRepository)
DependsOnDistributionRepository = provide_repository(DistributionRepository)
DependsOnDocumentRepository = provide_repository(DocumentRepository)
DependsOnGroupRepository = provide_repository(GroupRepository)
DependsOnIntentionRepository = provide_repository(IntentionRepository)
DependsOnPluginRepository = provide_repository(PluginRepository)
DependsOnPluginInstanceRepository = provide_repository(
    PluginInstanceRepository
)
DependsOnProjectRepository = provide_repository(ProjectRepository)
DependsOnProposalRepository = provide_repository(ProposalRepository)
DependsOnRoleRepository = provide_repository(RoleRepository)
DependsOnSystemHealthRepository = provide_repository(SystemHealthRepository)
DependsOnSystemSettingsRepository = provide_repository(
    SystemSettingsRepository
)
DependsOnSystemStatusRepository = provide_repository(SystemStatusRepository)
DependsOnTaskRepository = provide_repository(TaskRepository)
DependsOnTaskItemRepository = provide_repository(TaskItemRepository)
DependsOnScheduledTaskRepository = provide_repository(ScheduledTaskRepository)
DependsOnUserRepository = provide_repository(UserRepository)
DependsOnWatchlistRepository = provide_repository(WatchlistRepository)

DependsOnAdditionService = provide_service(
    AdditionService, DependsOnAdditionRepository
)
DependsOnCatalogRecordService = provide_service(
    CatalogRecordService,
    DependsOnCatalogRecordRepository,
)
DependsOnCatalogSearchService = provide_service(
    CatalogSearchService,
    DependsOnCatalogAdapter,
    DependsOnCatalogRecordRepository,
)
DependsOnCategoryService = provide_service(
    CategoryService, DependsOnCategoryRepository
)
DependsOnDigiListService = provide_service(
    DigiListService,
    DependsOnDigiListRepository,
    DependsOnDocumentRepository,
    DependsOnIntentionRepository,
)
DependsOnDistributionService = provide_service(
    DistributionService,
    DependsOnDistributionRepository,
    DependsOnCategoryRepository,
)
DependsOnDocumentService = provide_service(
    DocumentService,
    DependsOnDocumentRepository,
)
DependsOnGroupService = provide_service(
    GroupService,
    DependsOnGroupRepository,
    DependsOnUserRepository,
)
DependsOnIntentionService = provide_service(
    IntentionService, DependsOnIntentionRepository
)
DependsOnPluginService = provide_service(
    PluginRepository,
    DependsOnPluginRepository,
)
DependsOnPluginInstanceService = provide_service(
    PluginInstanceRepository,
    DependsOnPluginRepository,
    DependsOnPluginInstanceRepository,
)
DependsOnProjectService = provide_service(
    ProjectService,
    DependsOnProjectRepository,
    DependsOnGroupRepository,
    DependsOnUserRepository,
)
DependsOnProposalService = provide_service(
    ProposalService,
    DependsOnProposalRepository,
    DependsOnDocumentRepository,
    DependsOnIntentionRepository,
)
DependsOnTaskService = provide_service(TaskService, DependsOnTaskRepository)
DependsOnScheduledTaskService = provide_service(
    ScheduledTaskService,
    DependsOnScheduledTaskRepository,
)

DependsOnAuthenticatedUser = Depends(resolve_authenticated_user)

ResolveTaskScheduleParams = Depends(resolve_schedule_params)

RestrictedSearch = get_restricted_search
RestrictedQuery = get_restricted_query
RestrictedParams = get_restricted_params
RestrictedFilterParams = get_restricted_filter_params

WithPermission = require_permission
WithEnforcedOwnership = enforce_ownership
