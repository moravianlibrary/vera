from typing import Annotated

from fastapi import APIRouter, Path, Query

from adapters.indexer import IndexerQuery, IndexerRequest, IndexerResponse
from definitions.permission import GeneralPermission, OwnershipPermission
from repositories.task import ScheduledTaskRepository, TaskItemRepository
from schemas.common import Page, PageParams
from schemas.task import (
    ScheduledTask,
    Task,
    TaskItem,
    TaskItemsFilterParams,
    TaskScheduleParams,
)
from schemas.user import AuthenticatedUser
from services.task import ScheduledTaskService, TaskService

from .resources import (
    DependsOnAuthenticatedUser,
    DependsOnScheduledTaskRepository,
    DependsOnScheduledTaskService,
    DependsOnTaskItemRepository,
    DependsOnTaskService,
    RestrictedQuery,
    RestrictedSearch,
    WithPermission,
)

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.post(
    "/search",
    dependencies=[WithPermission(OwnershipPermission.ReadTasks)],
    response_model=IndexerResponse[Task],
)
def search_tasks(
    request: IndexerRequest = RestrictedSearch(OwnershipPermission.ReadTasks),
    service: TaskService = DependsOnTaskService,
):
    return service.search(request)


@router.get(
    "/{task_id}/items",
    dependencies=[WithPermission(OwnershipPermission.ReadTasks)],
    response_model=Page[TaskItem],
)
def paginate_task_items(
    page_params: Annotated[PageParams, Query()],
    filter_params: Annotated[TaskItemsFilterParams, Query()],
    repository: TaskItemRepository = DependsOnTaskItemRepository,
):
    return repository.paginate(page_params, filter_params)


@router.patch(
    "/{task_id}/kill",
    dependencies=[WithPermission(OwnershipPermission.ManageTasks)],
    response_model=Task,
)
def kill_task(
    task_id: int = Path(...),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: TaskService = DependsOnTaskService,
):
    return service.kill(task_id, user.id)


@router.post(
    "/delete",
    dependencies=[WithPermission(OwnershipPermission.ManageTasks)],
    response_model=IndexerResponse[Task],
)
def delete_tasks(
    query: IndexerQuery = RestrictedQuery(OwnershipPermission.ManageTasks),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: TaskService = DependsOnTaskService,
):
    return service.delete(query, user.id)


@router.post(
    "/scheduled/search",
    dependencies=[
        WithPermission(
            OwnershipPermission.ReadTasks, GeneralPermission.ScheduleTasks
        )
    ],
    response_model=IndexerResponse[ScheduledTask],
)
def search_scheduled_tasks(
    request: IndexerRequest = RestrictedSearch(OwnershipPermission.ReadTasks),
    repository: ScheduledTaskRepository = DependsOnScheduledTaskRepository,
):
    return repository.search(request)


@router.put(
    "/scheduled/{task_id}",
    dependencies=[
        WithPermission(
            OwnershipPermission.ManageTasks, GeneralPermission.ScheduleTasks
        )
    ],
    response_model=ScheduledTask,
)
def update_scheduled_task(
    task_id: Annotated[int, Path()],
    params: Annotated[TaskScheduleParams, Query()],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: ScheduledTaskRepository = DependsOnScheduledTaskRepository,
    service: ScheduledTaskService = DependsOnScheduledTaskService,
):
    return service.update(
        repository.get_by_id(task_id), params, user.assignment
    )


@router.delete(
    "/scheduled/{task_id}",
    dependencies=[
        WithPermission(
            OwnershipPermission.ManageTasks, GeneralPermission.ScheduleTasks
        )
    ],
    response_model=ScheduledTask,
)
def delete_scheduled_task(
    task_id: int = Path(...),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: ScheduledTaskRepository = DependsOnScheduledTaskRepository,
):
    return repository.delete(task_id, user.assignment)
