from typing import Annotated, List

from fastapi import APIRouter, Path, Query

from adapters.indexer import IndexerRequest, IndexerResponse
from definitions.permission import GeneralPermission, OwnershipPermission
from definitions.project import ProjectStatus
from repositories.project import ProjectRepository
from schemas.assignment import AssignmentChange
from schemas.project import (
    Project,
    ProjectAdditionCreate,
    ProjectBatchParams,
    ProjectEdit,
)
from schemas.user import AuthenticatedUser
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
def search(
    request: IndexerRequest = RestrictedSearch(
        OwnershipPermission.ReadProjects
    ),
    repository: ProjectRepository = DependsOnProjectRepository,
):
    return repository.search(request)


@router.post(
    "",
    dependencies=[WithPermission(GeneralPermission.CreateProjects)],
    response_model=Project,
)
def create(
    project: ProjectEdit,
    repository: ProjectRepository = DependsOnProjectRepository,
):
    return repository.create(project)


@router.put(
    "/{project_id}",
    dependencies=[WithPermission(OwnershipPermission.ManageProjects)],
    response_model=Project,
)
def update(
    project: ProjectEdit,
    project_id: int = Path(...),
    repository: ProjectRepository = DependsOnProjectRepository,
):
    return repository.update(repository.get_by_id(project_id), project)


@router.patch(
    "/{project_id}/assignment",
    dependencies=[WithPermission(OwnershipPermission.ManageProjects)],
    response_model=Project,
)
def change_assignment(
    assignment_change: AssignmentChange,
    project_id: int = Path(...),
    service: ProjectService = DependsOnProjectRepository,
):
    return service.change_assignment(project_id, assignment_change)


@router.post(
    "/{project_id}/add-documents",
    dependencies=[WithPermission(OwnershipPermission.ReadProjects)],
    response_model=Project,
)
def add_documents(
    batch_params: Annotated[ProjectBatchParams, Query()],
    additions: List[ProjectAdditionCreate] | None = None,
    project_id: int = Path(...),
    service: ProjectService = DependsOnProjectRepository,
):
    return service.add_documents(project_id, batch_params, additions)


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
def change_categories_assignment(
    project_id: int = Path(...),
    categories: List[int] | None = None,
    repository: ProjectRepository = DependsOnProjectRepository,
    service: ProjectService = DependsOnProjectRepository,
):
    return service.change_assigned_categories(
        repository.get_by_id(project_id), categories
    )


@router.patch(
    "/{project_id}/approve",
    dependencies=[WithPermission(GeneralPermission.ReviewProjects)],
    response_model=Project,
)
def approve(
    message: str | None = None,
    project_id: int = Path(...),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: ProjectService = DependsOnProjectRepository,
):
    return service.change_status(
        project_id, ProjectStatus.Accepted, message, user
    )


@router.patch(
    "/{project_id}/reject",
    dependencies=[WithPermission(GeneralPermission.ReviewProjects)],
    response_model=Project,
)
def reject(
    message: str | None = None,
    project_id: int = Path(...),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: ProjectService = DependsOnProjectRepository,
):
    return service.change_status(
        project_id, ProjectStatus.Declined, message, user
    )


@router.delete(
    "/{project_id}",
    dependencies=[WithPermission(OwnershipPermission.ManageProjects)],
    response_model=Project,
)
def delete(
    project_id: int = Path(...),
    repository: ProjectRepository = DependsOnProjectRepository,
):
    return repository.delete(repository.get_by_id(project_id))
