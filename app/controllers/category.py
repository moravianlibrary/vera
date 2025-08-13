from typing import Annotated

from fastapi import APIRouter, Path, Query, status

from adapters.indexer import IndexerQuery, IndexerRequest, IndexerResponse
from definitions.permission import GeneralPermission, OwnershipPermission
from repositories import CategoryRepository
from schemas.authenticated_user import AuthenticatedUser
from schemas.category import (
    Category,
    CategoryEdit,
    CategoryHit,
    CategoryParentChangeParams,
)
from schemas.common import AssignmentChange
from schemas.task import TaskOrSchedule, TaskScheduleParams
from services import CategoryService

from .resources import (
    DependsOnAuthenticatedUser,
    DependsOnCategoryRepository,
    DependsOnCategoryService,
    RestrictedQuery,
    RestrictedSearch,
    RestrictedTaskScheduleParams,
    WithPermission,
)

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.post(
    "/search",
    dependencies=[WithPermission(OwnershipPermission.ReadCategories)],
    response_model=IndexerResponse[CategoryHit],
)
async def search(
    query: IndexerRequest = RestrictedSearch(
        OwnershipPermission.ReadCategories
    ),
    repository: CategoryRepository = DependsOnCategoryRepository,
):
    return await repository.search(query)


@router.post(
    "",
    dependencies=[WithPermission(OwnershipPermission.ManageCategories)],
    response_model=Category,
    status_code=status.HTTP_201_CREATED,
)
async def create(
    category: CategoryEdit,
    parent_id: int | None = Query(None),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CategoryService = DependsOnCategoryService,
):
    return await service.create(parent_id, category, user)


@router.put(
    "/{category_id}",
    dependencies=[WithPermission(OwnershipPermission.ManageCategories)],
    response_model=Category,
)
async def update(
    category_id: Annotated[int, Path(...)],
    category: CategoryEdit,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CategoryService = DependsOnCategoryService,
):
    return await service.update(category_id, category, user)


@router.patch(
    "/{category_id}/assignment",
    dependencies=[WithPermission(OwnershipPermission.ManageCategories)],
    response_model=Category,
)
async def change_assignment(
    category_id: Annotated[int, Path(...)],
    assignment_change: AssignmentChange,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CategoryService = DependsOnCategoryService,
):
    return await service.change_assignment(
        category_id, assignment_change, user
    )


@router.patch(
    "/{category_id}/parent",
    dependencies=[WithPermission(OwnershipPermission.ManageCategories)],
    response_model=Category,
)
async def change_parent(
    category_id: Annotated[int, Path(...)],
    params: Annotated[CategoryParentChangeParams, Query()],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CategoryService = DependsOnCategoryService,
):
    return await service.change_parent(category_id, params, user)


@router.patch(
    "/{category_id}/document-discovery",
    dependencies=[
        WithPermission(
            OwnershipPermission.ManageCategories,
            GeneralPermission.ReadDocumentDiscoveryPlugins,
        )
    ],
    response_model=Category,
)
async def change_document_discovery(
    category_id: Annotated[int, Path(...)],
    plugin_instance_id: Annotated[int | None, Query()],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CategoryService = DependsOnCategoryService,
):
    return await service.change_document_discovery(
        category_id, plugin_instance_id, user
    )


@router.post(
    "/reindex",
    dependencies=[WithPermission(OwnershipPermission.ReadCategories)],
    response_model=TaskOrSchedule,
)
async def reindex(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ReadCategories),
    schedule_params: TaskScheduleParams = RestrictedTaskScheduleParams,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CategoryService = DependsOnCategoryService,
):
    return await service.reindex(query, user.id, schedule_params)


@router.post(
    "/{category_id}/run-document-discovery",
    dependencies=[
        WithPermission(
            OwnershipPermission.ManageCategories,
            GeneralPermission.RunTasks,
        )
    ],
    response_model=TaskOrSchedule,
)
async def run_document_discovery(
    category_id: Annotated[int, Path(...)],
    schedule_params: TaskScheduleParams = RestrictedTaskScheduleParams,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CategoryService = DependsOnCategoryService,
):
    return await service.run_document_discovery(
        category_id, user.id, schedule_params
    )


@router.delete(
    "/{category_id}",
    dependencies=[WithPermission(OwnershipPermission.ManageCategories)],
    response_model=Category,
)
async def delete(
    category_id: int = Path(...),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: CategoryService = DependsOnCategoryService,
):
    return await service.delete(category_id, user)
