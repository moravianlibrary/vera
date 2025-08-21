from typing import Annotated, List

from fastapi import APIRouter, Path, Query

from adapters.indexer import IndexerRequest, IndexerResponse
from definitions.permission import GeneralPermission, OwnershipPermission
from definitions.project import ProjectStatus
from repositories.project import ProjectRepository
from schemas.authenticated_user import AuthenticatedUser
from schemas.common import AssignmentChange
from schemas.project import (
    Project,
    ProjectAdditionCreate,
    ProjectBatchParams,
    ProjectEdit,
)
from services.project import ProjectService

from .resources import (
    DependsOnAuthenticatedUser,
    DependsOnProjectRepository,
    RestrictedSearch,
    WithPermission,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post(
    "/search",
    dependencies=[WithPermission(OwnershipPermission.ReadProjects)],
    response_model=IndexerResponse[Project],
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
    repository: ProjectRepository = DependsOnProjectRepository,
):
    return await repository.create(project)


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
    service: ProjectService = DependsOnProjectRepository,
):
    return await service.change_assignment(project_id, assignment_change)


@router.post(
    "/{project_id}/add-documents",
    dependencies=[WithPermission(OwnershipPermission.ReadProjects)],
    response_model=Project,
)
async def add_documents(
    batch_params: Annotated[ProjectBatchParams, Query()],
    additions: List[ProjectAdditionCreate] | None = None,
    project_id: int = Path(...),
    service: ProjectService = DependsOnProjectRepository,
):
    return await service.add_documents(project_id, batch_params, additions)


@router.patch(
    "/{project_id}/categories-assignment",
    dependencies=[
        WithPermission(
            GeneralPermission.ReviewProjects,
            OwnershipPermission.ManageCategories,
        )
    ],
    response_model=Project,
)
async def change_categories_assignment(
    project_id: int = Path(...),
    categories: List[int] | None = None,
    repository: ProjectRepository = DependsOnProjectRepository,
    service: ProjectService = DependsOnProjectRepository,
):
    return await service.change_direct_categories(
        repository.get_by_id(project_id), categories
    )


@router.patch(
    "/{project_id}/approve",
    dependencies=[WithPermission(GeneralPermission.ReviewProjects)],
    response_model=Project,
)
async def approve(
    message: str | None = None,
    project_id: int = Path(...),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: ProjectService = DependsOnProjectRepository,
):
    return await service.change_status(
        project_id, ProjectStatus.Accepted, message, user
    )


@router.patch(
    "/{project_id}/reject",
    dependencies=[WithPermission(GeneralPermission.ReviewProjects)],
    response_model=Project,
)
async def reject(
    message: str | None = None,
    project_id: int = Path(...),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: ProjectService = DependsOnProjectRepository,
):
    return await service.change_status(
        project_id, ProjectStatus.Declined, message, user
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
