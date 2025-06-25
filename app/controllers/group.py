from fastapi import APIRouter, Path, Query

from definitions.permission import GeneralPermission
from repositories import GroupRepository
from schemas.group import Group, GroupAssignmentChange, GroupEdit
from schemas.pagination import Page
from services.group import GroupService

from ._resources import DependsOnGroupRepository, DependsOnGroupService
from ._security import WithPermission

router = APIRouter(prefix="/groups", tags=["Groups"])


@router.get(
    "",
    dependencies=[WithPermission(GeneralPermission.ReadUsersAndGroups)],
    response_model=Page[Group],
)
def paginate(
    page: int = Query(1, description="Page number"),
    page_size: int = Query(50, description="Page size"),
    repository: GroupRepository = DependsOnGroupRepository,
):
    return repository.paginate(page=page, page_size=page_size)


@router.post(
    "",
    dependencies=[WithPermission(GeneralPermission.ManageAccess)],
    response_model=Group,
)
def create(
    group: GroupEdit,
    repository: GroupRepository = DependsOnGroupRepository,
):
    return repository.create(group)


@router.put(
    "/{group_id}",
    dependencies=[WithPermission(GeneralPermission.ManageAccess)],
    response_model=Group,
)
def update(
    group: GroupEdit,
    group_id: int = Path(...),
    repository: GroupRepository = DependsOnGroupRepository,
):
    return repository.update(repository.get_by_id(group_id), group)


@router.patch(
    "/{group_id}/change-assignment",
    dependencies=[WithPermission(GeneralPermission.ManageAccess)],
    response_model=Group,
)
def change_assignment(
    group_assignment_change: GroupAssignmentChange,
    group_id: int = Path(...),
    service: GroupService = DependsOnGroupService,
):
    return service.change_assignment(group_id, group_assignment_change)


@router.delete(
    "/{group_id}",
    dependencies=[WithPermission(GeneralPermission.ManageAccess)],
    response_model=Group,
)
def delete(
    group_id: int = Path(...),
    repository: GroupRepository = DependsOnGroupRepository,
):
    return repository.delete(repository.get_by_id(group_id))
