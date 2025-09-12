from fastapi import Depends, HTTPException, status

from adapters.database import get_database_session
from adapters.indexer import get_indexer_session
from definitions.permission import GeneralPermission
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
from repositories.addition import AdditionBatchRepository
from repositories.catalog_record import CatalogRecordRepository
from repositories.document_iteration import DocumentIterationRepository
from repositories.plugin import PluginInstanceRepository, PluginRepository
from repositories.project import ProjectRepository
from repositories.proposal import ProposalBatchRepository
from repositories.system import (
    SystemHealthRepository,
    SystemSettingsRepository,
    SystemStatusRepository,
)
from repositories.task import (
    TaskItemRepository,
    TaskNotificationRepository,
    TaskRepository,
    TaskScheduleRepository,
)
from repositories.watchlist import (
    WatchlistNotificationRepository,
    WatchlistRepository,
)
from schemas.task import TaskScheduleParams
from services import (
    AdditionService,
    CatalogSearchService,
    CategoryService,
    DigiListService,
    DocumentService,
)
from services.catalog_record import CatalogRecordService
from services.group import GroupService
from services.intention import IntentionService
from services.project import ProjectService
from services.proposal import ProposalService
from services.task import TaskScheduleService, TaskService
from services.user import UserService
from services.watchlist import WatchlistService
from vera_state import get_catalog_adapter, get_identity_provider

from .providers import provide_repository, provide_service
from .resolvers import resolve_authenticated_user
from .restricted import (
    get_restricted_filter_params,
    get_restricted_params,
    get_restricted_query,
    get_restricted_search,
)
from .security import require_global_permission, require_permission

DependsOnDatabaseSession = Depends(get_database_session)
DependsOnIndexerSession = Depends(get_indexer_session)

DependsOnCatalogAdapter = Depends(get_catalog_adapter)
DependsOnIdentityProvider = Depends(get_identity_provider)

DependsOnAdditionRepository = provide_repository(AdditionRepository)
DependsOnAdditionBatchRepository = provide_repository(AdditionBatchRepository)
DependsOnCatalogRecordRepository = provide_repository(CatalogRecordRepository)
DependsOnCategoryRepository = provide_repository(CategoryRepository)
DependsOnDigiListRepository = provide_repository(DigiListRepository)
DependsOnDistributionRepository = provide_repository(DistributionRepository)
DependsOnDocumentRepository = provide_repository(DocumentRepository)
DependsOnDocumentIterationRepository = provide_repository(
    DocumentIterationRepository
)
DependsOnGroupRepository = provide_repository(GroupRepository)
DependsOnIntentionRepository = provide_repository(IntentionRepository)
DependsOnPluginRepository = provide_repository(PluginRepository)
DependsOnPluginInstanceRepository = provide_repository(
    PluginInstanceRepository
)
DependsOnProjectRepository = provide_repository(ProjectRepository)
DependsOnProposalRepository = provide_repository(ProposalRepository)
DependsOnProposalBatchRepository = provide_repository(ProposalBatchRepository)
DependsOnRoleRepository = provide_repository(RoleRepository)
DependsOnSystemHealthRepository = provide_repository(SystemHealthRepository)
DependsOnSystemSettingsRepository = provide_repository(
    SystemSettingsRepository
)
DependsOnSystemStatusRepository = provide_repository(SystemStatusRepository)
DependsOnTaskRepository = provide_repository(TaskRepository)
DependsOnTaskItemRepository = provide_repository(TaskItemRepository)
DependsOnTaskScheduleRepository = provide_repository(TaskScheduleRepository)
DependsOnTaskNotificationRepository = provide_repository(
    TaskNotificationRepository
)
DependsOnUserRepository = provide_repository(UserRepository)
DependsOnWatchlistRepository = provide_repository(WatchlistRepository)
DependsOnWatchlistNotificationRepository = provide_repository(
    WatchlistNotificationRepository
)

DependsOnAdditionService = provide_service(
    AdditionService,
    DependsOnAdditionRepository,
    DependsOnAdditionBatchRepository,
    DependsOnTaskRepository,
)
DependsOnCatalogRecordService = provide_service(
    CatalogRecordService,
    DependsOnCatalogRecordRepository,
    DependsOnTaskRepository,
    DependsOnTaskScheduleRepository,
)
DependsOnCatalogSearchService = provide_service(
    CatalogSearchService,
    DependsOnCatalogAdapter,
    DependsOnCatalogRecordRepository,
)
DependsOnCategoryService = provide_service(
    CategoryService,
    DependsOnCategoryRepository,
    DependsOnDistributionRepository,
    DependsOnGroupRepository,
    DependsOnUserRepository,
    DependsOnTaskRepository,
    DependsOnTaskScheduleRepository,
)
DependsOnDigiListService = provide_service(
    DigiListService,
    DependsOnDigiListRepository,
    DependsOnDocumentRepository,
    DependsOnIntentionRepository,
    DependsOnTaskRepository,
)
DependsOnDocumentService = provide_service(
    DocumentService,
    DependsOnDocumentRepository,
    DependsOnDocumentIterationRepository,
    DependsOnCategoryRepository,
    DependsOnTaskRepository,
    DependsOnTaskScheduleRepository,
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
    DependsOnProposalBatchRepository,
    DependsOnAdditionBatchRepository,
    DependsOnTaskRepository,
)
DependsOnProposalService = provide_service(
    ProposalService,
    DependsOnProposalRepository,
    DependsOnProposalBatchRepository,
    DependsOnTaskRepository,
)
DependsOnTaskService = provide_service(
    TaskService, DependsOnTaskRepository, DependsOnTaskScheduleRepository
)
DependsOnTaskScheduleService = provide_service(
    TaskScheduleService,
    DependsOnTaskScheduleRepository,
)
DependsOnUserService = provide_service(
    UserService,
    DependsOnUserRepository,
    DependsOnTaskNotificationRepository,
    DependsOnWatchlistNotificationRepository,
)
DependsOnWatchlistService = provide_service(
    WatchlistService,
    DependsOnWatchlistRepository,
)

DependsOnAuthenticatedUser = Depends(resolve_authenticated_user)

RestrictedSearch = get_restricted_search
RestrictedQuery = get_restricted_query
RestrictedParams = get_restricted_params
RestrictedFilterParams = get_restricted_filter_params

RestrictedTaskScheduleParams = get_restricted_params(
    GeneralPermission.ScheduleTasks,
    TaskScheduleParams,
    exception=HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to schedule tasks.",
    ),
)

WithPermission = require_permission
WithGlobalPermission = require_global_permission
