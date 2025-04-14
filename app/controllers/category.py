from fastapi import APIRouter, Path, Query

from custom_types import GeneralPermission, OwnershipPermission
from repositories import CategoryRepository
from schemas import AuthenticatedUser, Category, CategoryEdit

from ._resources import DependsOnCategoryRepository
from .security import DependsOnAuthenticatedUser, WithPermission

router = APIRouter(prefix="/roles", tags=["Categorys"])


@router.post(
    "/search",
    dependencies=[WithPermission(OwnershipPermission.ReadCategories)],
    response_model=Category,
)
def search(
    query,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: CategoryRepository = DependsOnCategoryRepository,
):
    # TODO: Security - restrict query based on scope
    return repository.search(query)


@router.post(
    "",
    dependencies=[WithPermission(OwnershipPermission.CreateCategories)],
    response_model=Category,
)
def create(
    category: CategoryEdit,
    parent_id: int | None = Query(None),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CategoryService = DependsOnCategoryService,
):
    # TODO: Enforce that the user has access to the parent category
    return service.create(
        parent_id,
        category.name,
        category.description,
        category.assignable,
        category.disabled,
    )


# TODO: Move to project controller
@router.post(
    "/p",
    dependencies=[WithPermission(GeneralPermission.CreateProjects)],
    response_model=Category,
)
def create_project_category(
    project_id: int,
    category_name: str,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CategoryService = DependsOnCategoryService,
):
    # TODO: Enforce that the user owns the project
    return service.create_project_category(project_id, category_name, user)


@router.put(
    "/{category_id}",
    dependencies=[WithPermission(OwnershipPermission.ManageCategories)],
    response_model=Category,
)
def update(
    role: CategoryEdit,
    category_id: int = Path(...),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CategoryService = DependsOnCategoryService,
):
    # TODO: Enforce that the user owns the project
    return service.update(category_id, role)


@router.put(
    "/{category_id}/change-parent",
    dependencies=[WithPermission(GeneralPermission.ManageAccess)],
    response_model=Category,
)
def change_parent(
    category_id: int = Path(...),
    from_parent_id: int | None = Query(None),
    to_parent_id: int | None = Query(None),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CategoryService = DependsOnCategoryService,
):
    # TODO: Enforce that the user owns the project
    return service.change_parent(category_id, from_parent_id, to_parent_id)


@router.delete(
    "/{category_id}",
    dependencies=[WithPermission(GeneralPermission.ManageAccess)],
    response_model=Category,
)
def delete(
    category_id: int = Path(...),
    repository: CategoryRepository = DependsOnCategoryRepository,
):
    return repository.delete(repository.get_by_id(category_id))
