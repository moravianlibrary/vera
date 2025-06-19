from fastapi import APIRouter, Path, Query

from adapters.indexer import IndexerQuery
from definitions.permission import OwnershipPermission
from repositories import CategoryRepository
from schemas.category import Category, CategoryAssignmentChange, CategoryEdit
from schemas.user import AuthenticatedUser
from services import CategoryService

from ._resources import (
    DependsOnCategoryRepository,
    DependsOnCategoryService,
    RestrictedQuery,
)
from ._security import DependsOnAuthenticatedUser, WithPermission

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.post(
    "/search",
    dependencies=[WithPermission(OwnershipPermission.ReadCategories)],
    response_model=Category,
)
def search(
    query: IndexerQuery[Category] = RestrictedQuery(
        OwnershipPermission.ReadCategories
    ),
    repository: CategoryRepository = DependsOnCategoryRepository,
):
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
    return service.create(parent_id, category, user)


@router.put(
    "/{category_id}",
    dependencies=[WithPermission(OwnershipPermission.ManageCategories)],
    response_model=Category,
)
def update(
    category: CategoryEdit,
    category_id: int = Path(...),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CategoryService = DependsOnCategoryService,
):
    return service.update(category_id, category, user)


@router.patch(
    "/{category_id}/change-assignment",
    dependencies=[WithPermission(OwnershipPermission.ManageCategories)],
    response_model=Category,
)
def change_assignment(
    category_assignment_change: CategoryAssignmentChange,
    category_id: int = Path(...),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CategoryService = DependsOnCategoryService,
):
    return service.change_assignment(
        category_id, category_assignment_change, user
    )


@router.patch(
    "/{category_id}/change-parent",
    dependencies=[WithPermission(OwnershipPermission.ManageCategories)],
    response_model=Category,
)
def change_parent(
    category_id: int = Path(...),
    from_parent_id: int | None = Query(None),
    to_parent_id: int | None = Query(None),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CategoryService = DependsOnCategoryService,
):
    return service.change_parent(
        category_id, from_parent_id, to_parent_id, user
    )


@router.delete(
    "/{category_id}",
    dependencies=[WithPermission(OwnershipPermission.ManageCategories)],
    response_model=Category,
)
def delete(
    category_id: int = Path(...),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CategoryService = DependsOnCategoryService,
):
    return service.delete(category_id, user)
