from fastapi import APIRouter, Path, Query

from custom_types import GeneralPermission
from repositories import RoleRepository
from schemas.pagination import Page
from schemas.role import Role, RoleEdit

from ._resources import DependsOnRoleRepository
from ._security import WithPermission

router = APIRouter(prefix="/roles", tags=["Roles"])


@router.get(
    "",
    dependencies=[WithPermission(GeneralPermission.ManageAccess)],
    response_model=Page[Role],
)
def paginate(
    page: int = Query(1, description="Page number"),
    page_size: int = Query(50, description="Page size"),
    repository: RoleRepository = DependsOnRoleRepository,
):
    return repository.paginate(page=page, page_size=page_size)


@router.post(
    "",
    dependencies=[WithPermission(GeneralPermission.ManageAccess)],
    response_model=Role,
)
def create(
    role: RoleEdit,
    repository: RoleRepository = DependsOnRoleRepository,
):
    return repository.create(role.name, role.description)


@router.put(
    "/{role_id}",
    dependencies=[WithPermission(GeneralPermission.ManageAccess)],
    response_model=Role,
)
def update(
    role: RoleEdit,
    role_id: int = Path(...),
    repository: RoleRepository = DependsOnRoleRepository,
):
    return repository.update(role_id, role)


@router.delete(
    "/{role_id}",
    dependencies=[WithPermission(GeneralPermission.ManageAccess)],
    response_model=Role,
)
def delete(
    role_id: int = Path(...),
    repository: RoleRepository = DependsOnRoleRepository,
):
    return repository.delete(repository.get_by_id(role_id))
