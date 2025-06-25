from typing import Annotated

from fastapi import APIRouter, Path, Query

from adapters.indexer import IndexerQuery, IndexerRequest, IndexerResponse
from definitions.permission import GeneralPermission, OwnershipPermission
from repositories import CategoryRepository
from schemas.assignment import AssignmentChange
from schemas.category import Category, CategoryEdit, CategoryParentChangeParams
from schemas.task import TaskScheduleParams
from schemas.user import AuthenticatedUser
from services import CategoryService

from ._resources import (
    DependsOnCategoryRepository,
    DependsOnCategoryService,
    RestrictedQuery,
    RestrictedSearchRequest,
)
from ._security import (
    DependsOnAuthenticatedUser,
    ResolveTaskScheduleParams,
    WithPermission,
)

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.post(
    "/search",
    dependencies=[WithPermission(OwnershipPermission.ReadCategories)],
    response_model=IndexerResponse[Category],
)
def search(
    query: IndexerRequest = RestrictedSearchRequest(
        OwnershipPermission.ReadCategories
    ),
    repository: CategoryRepository = DependsOnCategoryRepository,
):
    return repository.search(query)


@router.post(
    "",
    dependencies=[WithPermission(OwnershipPermission.ManageCategories)],
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
    category_id: Annotated[int, Path(...)],
    category: CategoryEdit,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CategoryService = DependsOnCategoryService,
):
    return service.update(category_id, category, user)


@router.patch(
    "/{category_id}/assignment",
    dependencies=[WithPermission(OwnershipPermission.ManageCategories)],
    response_model=Category,
)
def change_assignment(
    category_id: Annotated[int, Path(...)],
    assignment_change: AssignmentChange,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CategoryService = DependsOnCategoryService,
):
    return service.change_assignment(category_id, assignment_change, user)


@router.patch(
    "/{category_id}/parent",
    dependencies=[WithPermission(OwnershipPermission.ManageCategories)],
    response_model=Category,
)
def change_parent(
    category_id: Annotated[int, Path(...)],
    params: Annotated[CategoryParentChangeParams, Query()],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CategoryService = DependsOnCategoryService,
):
    return service.change_parent(category_id, params, user)


@router.patch(
    "/{category_id}/document-discovery/{plugin_instance_id}",
    dependencies=[
        WithPermission(
            OwnershipPermission.ManageCategories,
            GeneralPermission.ReadPlugins,
            require_all=True,
        )
    ],
    response_model=Category,
)
def change_document_discovery(
    category_id: Annotated[int, Path(...)],
    plugin_instance_id: Annotated[int | None, Path(None)],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CategoryService = DependsOnCategoryService,
):
    return service.change_document_discovery(
        category_id, plugin_instance_id, user
    )


@router.post(
    "/reindex",
    dependencies=[WithPermission(OwnershipPermission.ReadCategories)],
    response_model=IndexerResponse[Category],
)
def reindex(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ReadCategories),
    schedule_params: TaskScheduleParams | None = ResolveTaskScheduleParams,
    service: CategoryService = DependsOnCategoryService,
):
    return service.reindex(query, schedule_params)


@router.post(
    "/{category_id}/document-discovery",
    dependencies=[
        WithPermission(
            OwnershipPermission.ManageCategories,
            GeneralPermission.ReadPlugins,
            require_all=True,
        )
    ],
)
def init_document_discovery(
    category_id: Annotated[int, Path(...)],
    schedule_params: TaskScheduleParams | None = ResolveTaskScheduleParams,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CategoryService = DependsOnCategoryService,
):
    return service.init_document_discovery(category_id, user, schedule_params)


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
