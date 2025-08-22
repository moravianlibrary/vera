from typing import Annotated

from fastapi import APIRouter, Path, Query

from adapters.identity_provider import IdentityProvider
from definitions.permission import GeneralPermission
from errors.role import AdminRoleDeletionError, AdminRoleModificationError
from repositories import RoleRepository
from schemas.common import Page, PageParams
from schemas.role import Role, RoleEdit, RoleSummary

from .resources import (
    DependsOnIdentityProvider,
    DependsOnRoleRepository,
    WithPermission,
)

router = APIRouter(prefix="/roles", tags=["Roles"])


@router.get(
    "",
    dependencies=[WithPermission(GeneralPermission.ReadUsersAndGroups)],
    response_model=Page[Role],
)
def paginate(
    page_params: Annotated[PageParams, Query()],
    repository: RoleRepository = DependsOnRoleRepository,
):
    return repository.paginate(page_params)


@router.post(
    "",
    dependencies=[WithPermission(GeneralPermission.ManageAccess)],
    response_model=Role,
)
def create(
    role_edit: RoleEdit,
    repository: RoleRepository = DependsOnRoleRepository,
):
    return repository.create(role_edit)


@router.put(
    "/{role_id}",
    dependencies=[WithPermission(GeneralPermission.ManageAccess)],
    response_model=Role,
)
def update(
    role_edit: RoleEdit,
    role_id: int = Path(...),
    repository: RoleRepository = DependsOnRoleRepository,
):
    if role_id == 1:
        raise AdminRoleModificationError()
    return repository.update(repository.get_by_id(role_id), role_edit)


@router.delete(
    "/{role_id}",
    dependencies=[WithPermission(GeneralPermission.ManageAccess)],
    response_model=Role,
)
def delete(
    role_id: int = Path(...),
    repository: RoleRepository = DependsOnRoleRepository,
):
    if role_id == 1:
        raise AdminRoleDeletionError()
    return repository.delete(repository.get_by_id(role_id))


@router.get(
    "/from-identity-provider",
    dependencies=[WithPermission(GeneralPermission.ReadUsersAndGroups)],
    response_model=Page[RoleSummary],
)
def paginate_identity_provider(
    page_params: Annotated[PageParams, Query()],
    role_name: str | None = Query(None),
    identity_provider: IdentityProvider = DependsOnIdentityProvider,
):
    return identity_provider.paginate_roles(page_params, role_name)
