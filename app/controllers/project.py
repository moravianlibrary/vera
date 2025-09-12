from typing import Annotated, List

from fastapi import APIRouter, Path, Query
from fastapi.params import Body

from adapters.indexer import IndexerQuery, IndexerRequest, IndexerResponse
from definitions.permission import GeneralPermission, OwnershipPermission
from definitions.project import ProjectStatus
from definitions.watchlist import WatchlistTarget
from repositories.project import ProjectRepository
from repositories.watchlist import WatchlistRepository
from schemas.addition import (
    AdditionCreate,
    IngestAdditionsParams,
    IngestAdditionsResponse,
)
from schemas.authenticated_user import AuthenticatedUser
from schemas.common import (
    AssignmentChange,
    BatchParams,
    Message,
    PriorityChange,
)
from schemas.project import Project, ProjectEdit
from schemas.proposal import IngestProposalsResponse, ProposalCreate
from schemas.watchlist import Watchlist, WatchlistPropertiesParams
from services.project import ProjectService

from .resources import (
    DependsOnAuthenticatedUser,
    DependsOnProjectRepository,
    DependsOnProjectService,
    DependsOnWatchlistRepository,
    RestrictedSearch,
    WithGlobalPermission,
    WithPermission,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post(
    "/search",
    dependencies=[WithPermission(OwnershipPermission.ReadProjects)],
    response_model=IndexerResponse,
)
async def search(
    request: IndexerRequest = RestrictedSearch(
        OwnershipPermission.ReadProjects
    ),
    repository: ProjectRepository = DependsOnProjectRepository,
):
    return await repository.search(request)


@router.post(
    "",
    dependencies=[WithPermission(GeneralPermission.CreateProjects)],
    response_model=Project,
)
async def create(
    project: ProjectEdit,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: ProjectRepository = DependsOnProjectRepository,
):
    return await repository.create(project, user.id)


@router.put(
    "/{project_id}",
    dependencies=[WithPermission(OwnershipPermission.ManageProjects)],
    response_model=Project,
)
async def update(
    project: ProjectEdit,
    project_id: int = Path(...),
    repository: ProjectRepository = DependsOnProjectRepository,
):
    return await repository.update(repository.get_by_id(project_id), project)


@router.patch(
    "/{project_id}/assignment",
    dependencies=[WithPermission(OwnershipPermission.ManageProjects)],
    response_model=Project,
)
async def change_assignment(
    assignment_change: AssignmentChange,
    project_id: int = Path(...),
    service: ProjectService = DependsOnProjectService,
):
    return await service.change_assignment(project_id, assignment_change)


@router.post(
    "/{project_id}/propose-documents",
    dependencies=[
        WithPermission(
            OwnershipPermission.ReadProjects,
            GeneralPermission.ProposeDocuments,
        )
    ],
    response_model=IngestProposalsResponse,
)
async def propose_documents(
    project_id: Annotated[int, Path(...)],
    batch_params: Annotated[BatchParams, Query()],
    proposals: Annotated[List[ProposalCreate], Body(min_length=1)],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: ProjectService = DependsOnProjectService,
):
    return await service.propose_documents(
        project_id, batch_params, proposals, user.id
    )


@router.post(
    "/{project_id}/add-documents",
    dependencies=[
        WithPermission(
            OwnershipPermission.ReadProjects,
            GeneralPermission.AddDocuments,
            OwnershipPermission.ReadCategories,
        )
    ],
    response_model=IngestAdditionsResponse,
)
async def add_documents(
    project_id: Annotated[int, Path(...)],
    ingest_params: Annotated[IngestAdditionsParams, Query()],
    additions: Annotated[List[AdditionCreate], Body(min_length=1)],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: ProjectService = DependsOnProjectService,
):
    return await service.add_documents(
        project_id, ingest_params, additions, user.id
    )


@router.delete(
    "/{project_id}",
    dependencies=[WithPermission(OwnershipPermission.ManageProjects)],
    response_model=Project,
)
async def delete(
    project_id: int = Path(...),
    repository: ProjectRepository = DependsOnProjectRepository,
):
    return await repository.delete(repository.get_by_id(project_id))


@router.patch(
    "/{project_id}/priority",
    dependencies=[WithPermission(GeneralPermission.ReviewProjects)],
    response_model=Project,
)
async def change_priority(
    priority: PriorityChange,
    project_id: int = Path(...),
    service: ProjectService = DependsOnProjectService,
):
    return await service.change_priority(project_id, priority)


@router.patch(
    "/{project_id}/approve",
    dependencies=[WithPermission(GeneralPermission.ReviewProjects)],
    response_model=Project,
)
async def approve(
    message: Message | None = None,
    project_id: int = Path(...),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: ProjectService = DependsOnProjectService,
):
    return await service.change_status(
        project_id, ProjectStatus.Approved, message, user
    )


@router.patch(
    "/{project_id}/reject",
    dependencies=[WithPermission(GeneralPermission.ReviewProjects)],
    response_model=Project,
)
async def reject(
    message: Message | None = None,
    project_id: int = Path(...),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: ProjectService = DependsOnProjectService,
):
    return await service.change_status(
        project_id, ProjectStatus.Rejected, message, user
    )


@router.post(
    "/watchlist",
    dependencies=[
        WithPermission(GeneralPermission.ManageWatchlists),
        WithGlobalPermission(OwnershipPermission.ReadProjects),
    ],
    response_model=Watchlist,
)
async def create_watchlist(
    query: IndexerQuery,
    params: Annotated[WatchlistPropertiesParams, Query()],
    repository: WatchlistRepository = DependsOnWatchlistRepository,
):
    return await repository.create(params, WatchlistTarget.Projects, query)
