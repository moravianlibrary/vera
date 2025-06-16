from fastapi import APIRouter, Path

from custom_types import GeneralPermission, OwnershipPermission
from repositories import ProjectRepository
from schemas import Project, ProjectEdit

from ._resources import DependsOnProjectRepository
from ._security import WithPermission

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get(
    "/search",
    dependencies=[WithPermission(OwnershipPermission.ReadProjects)],
    response_model=Project,
)
def search(
    repository: ProjectRepository = DependsOnProjectRepository,
):
    pass


@router.post(
    "",
    dependencies=[WithPermission(OwnershipPermission.ManageProjects)],
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
    return repository.update(project_id, project)


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


@router.post(
    "/{project_id}/approve",
    dependencies=[WithPermission(GeneralPermission.ManageProjects)],
    response_model=Project,
)
def approve(
    project_id: int = Path(...),
    repository: ProjectRepository = DependsOnProjectRepository,
):
    pass


@router.post(
    "/{project_id}/reject",
    dependencies=[WithPermission(GeneralPermission.ManageProjects)],
    response_model=Project,
)
def reject(
    project_id: int = Path(...),
    repository: ProjectRepository = DependsOnProjectRepository,
):
    pass
