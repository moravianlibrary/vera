from fastapi import APIRouter, Path, Query

from custom_types import GeneralPermission
from repositories import GroupRepository
from repositories.models import GroupModel
from schemas import Group, GroupEdit, Page

from ._resources import DependsOnGroupRepository
from .security import WithPermission

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
    if repository.find_by_name(group.name):
        raise ValueError(f"Group with the name '{group.name}' already exists")
    return repository.save(
        GroupModel(name=group.name, description=group.description)
    )


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
    group_model: GroupModel = repository.get_by_id(group_id)
    group_model.name = group.name
    group_model.description = group.description
    return repository.save(group_model)


@router.delete(
    "/{department_id}",
    dependencies=[WithPermission(GeneralPermission.ManageAccess)],
    response_model=Group,
)
def delete(
    group_id: int = Path(...),
    repository: GroupRepository = DependsOnGroupRepository,
):
    return repository.delete(repository.get_by_id(group_id))
