from typing import Annotated

from fastapi import APIRouter, Path, Query

from adapters.indexer import IndexerQuery, IndexerRequest, IndexerResponse
from definitions.json import JsonObject
from definitions.permission import GeneralPermission, OwnershipPermission
from repositories.task import (
    TaskItemRepository,
    TaskRepository,
    TaskScheduleRepository,
)
from schemas.authenticated_user import AuthenticatedUser
from schemas.common import Page, PageParams
from schemas.task import (
    Task,
    TaskItem,
    TaskItemsFilterParams,
    TaskSchedule,
    TaskScheduleParams,
)
from services.task import TaskScheduleService, TaskService

from .resources import (
    DependsOnAuthenticatedUser,
    DependsOnTaskItemRepository,
    DependsOnTaskRepository,
    DependsOnTaskScheduleRepository,
    DependsOnTaskScheduleService,
    DependsOnTaskService,
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
    repository: TaskScheduleRepository = DependsOnTaskScheduleRepository,
):
    return repository.search(request)


@router.get(
    "/{task_id}/query",
    dependencies=[WithPermission(OwnershipPermission.ReadTasks)],
    response_model=IndexerQuery,
)
def get_task_query(
    task_id: int = Path(...),
    service: TaskService = DependsOnTaskService,
):
    return service.get_query(task_id)


@router.get(
    "/{task_id}/data",
    dependencies=[WithPermission(OwnershipPermission.ReadTasks)],
    response_model=JsonObject,
)
def get_task_data(
    task_id: int = Path(...),
    service: TaskService = DependsOnTaskService,
):
    return service.get_data(task_id)


@router.get(
    "/{task_id}/log",
    dependencies=[WithPermission(OwnershipPermission.ReadTasks)],
)
def get_task_log(
    task_id: int = Path(...),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: TaskService = DependsOnTaskService,
):
    return service.get_log(task_id, user)


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
    repository: TaskRepository = DependsOnTaskRepository,
    service: TaskService = DependsOnTaskService,
):
    return service.kill(repository.get_by_id(task_id), user)


@router.delete(
    "/{task_id}",
    dependencies=[WithPermission(OwnershipPermission.ManageTasks)],
    response_model=Task,
)
def delete_tasks(
    task_id: int = Path(...),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: TaskRepository = DependsOnTaskRepository,
    service: TaskService = DependsOnTaskService,
):
    return service.delete(repository.get_by_id(task_id), user)


@router.post(
    "/schedules/search",
    dependencies=[
        WithPermission(
            OwnershipPermission.ReadTasks, GeneralPermission.ScheduleTasks
        )
    ],
    response_model=IndexerResponse[TaskSchedule],
)
def search_task_schedules(
    request: IndexerRequest = RestrictedSearch(OwnershipPermission.ReadTasks),
    repository: TaskScheduleRepository = DependsOnTaskScheduleRepository,
):
    return repository.search(request)


@router.put(
    "/schedules/{task_id}",
    dependencies=[
        WithPermission(
            OwnershipPermission.ManageTasks, GeneralPermission.ScheduleTasks
        )
    ],
    response_model=TaskSchedule,
)
def update_task_schedule(
    task_id: Annotated[int, Path()],
    params: Annotated[TaskScheduleParams, Query()],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: TaskScheduleRepository = DependsOnTaskScheduleRepository,
    service: TaskScheduleService = DependsOnTaskScheduleService,
):
    return service.update(
        repository.get_by_id(task_id), params, user.assignment
    )


@router.delete(
    "/schedules/{task_id}",
    dependencies=[
        WithPermission(
            OwnershipPermission.ManageTasks, GeneralPermission.ScheduleTasks
        )
    ],
    response_model=TaskSchedule,
)
def delete_task_schedule(
    task_id: int = Path(...),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: TaskScheduleRepository = DependsOnTaskScheduleRepository,
):
    return repository.delete(task_id, user.assignment)
