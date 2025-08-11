from typing import Dict

from fastapi import HTTPException, Response, status
from pydantic import BaseModel

from adapters.indexer import IndexerQuery
from definitions.task import (
    TASK_STATE_PREDECESSORS,
    TaskScope,
    TaskState,
    TaskType,
)
from repositories.models.task import (
    TaskModel,
    TaskOrScheduleModel,
    TaskScheduleModel,
)
from repositories.task import TaskRepository, TaskScheduleRepository
from schemas.authenticated_user import AuthenticatedUser
from schemas.task import Task, TaskScheduleParams
from tasks.entrypoint import init_task


class TaskService:
    def __init__(self, task_repository: TaskRepository):
        self._task_repository = task_repository

    def _enforce_read_ownership(
        self, task_id: int, user: AuthenticatedUser
    ) -> TaskModel:
        pass

    def _enforce_manage_ownership(
        self, task_id: int, user: AuthenticatedUser
    ) -> TaskModel:
        pass

    def serialize_entity(self, task: TaskModel) -> Task:
        return self._task_repository.serialize_entity(task)

    async def create(
        self,
        scope: TaskScope,
        task_type: TaskType,
        name: str,
        created_by: str,
        query: IndexerQuery | None = None,
        data: BaseModel | None = None,
    ) -> TaskModel:
        task = await self._task_repository.create(
            scope,
            task_type,
            name,
            created_by,
            query,
            data.model_dump(mode="json") if data else None,
        )

        init_task.delay(task.id)

        return task

    def get_log(self, task: TaskModel, user: AuthenticatedUser) -> bytes:
        log_bytes = self._enforce_read_ownership(task, user).log

        if log_bytes is None:
            return HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No log available for this task.",
            )

        filename = f"vera_task_{task.id}.log"
        return Response(
            content=log_bytes.decode("utf-8"),
            media_type="text/plain",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )

    def kill(self, task: TaskModel, user: AuthenticatedUser) -> TaskModel:
        self._enforce_manage_ownership(task, user)

        if task.task_state not in TASK_STATE_PREDECESSORS[TaskState.Killed]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Task in state {task.task_state} cannot be killed.",
            )

        return self._task_repository.index(
            self._task_repository.kill(task), True
        )

    def delete(self, task: TaskModel, user: AuthenticatedUser) -> TaskModel:
        self._enforce_manage_ownership(task, user)
        return self._task_repository.delete(task)


class TaskScheduleService:
    def __init__(self, task_schedule_repository: TaskScheduleRepository):
        self._task_schedule_repository = task_schedule_repository

    def _enforce_manage_ownership(
        self, task_schedule_id: int, user: AuthenticatedUser
    ) -> TaskScheduleModel:
        pass

    async def create(
        self,
        scope: TaskScope,
        task_type: TaskType,
        schedule_params: TaskScheduleParams,
        created_by: str,
        query: IndexerQuery | None,
    ):
        return self._task_schedule_repository.create(
            scope,
            task_type,
            schedule_params.name,
            schedule_params.cron_expression,
            created_by,
            query,
        )


class TaskBasedService:
    _task_scope: TaskScope | None = None
    _task_names_mapping: Dict[TaskType, str] | None = None

    def __init__(self, task_repository: TaskRepository):
        self._task_service = TaskService(task_repository)

    async def _create_task(
        self,
        task_type: TaskType,
        created_by: str,
        query: IndexerQuery | None = None,
        data: BaseModel | None = None,
        name: str | None = None,
    ) -> TaskModel:
        return await self._task_service.create(
            self._task_scope,
            task_type,
            name or self._task_names_mapping[task_type],
            created_by,
            query,
            data,
        )

    def _serialize_task(self, task: TaskModel) -> Task:
        return self._task_service.serialize_entity(task)


class TaskAndScheduleBasedService(TaskBasedService):
    def __init__(
        self,
        task_repository: TaskRepository,
        task_schedule_repository: TaskScheduleRepository,
    ):
        super().__init__(task_repository)
        self._task_schedule_repository = task_schedule_repository
        self._task_schedule_service = TaskScheduleService(
            task_schedule_repository
        )

    async def _schedule_task(
        self,
        task_type: TaskType,
        created_by: str,
        schedule_params: TaskScheduleParams,
        query: IndexerQuery | None = None,
        data: BaseModel | None = None,
    ) -> TaskScheduleModel:
        return await self._task_schedule_service.create(
            self._task_scope,
            task_type,
            schedule_params,
            created_by,
            query,
            data.model_dump(mode="json") if data else None,
        )

    async def _create_or_schedule_task(
        self,
        task_type: TaskType,
        created_by: str,
        schedule_params: TaskScheduleParams,
        query: IndexerQuery | None = None,
        data: BaseModel | None = None,
    ) -> TaskOrScheduleModel:
        if schedule_params.name and schedule_params.cron_expression:
            return await self._schedule_task(
                task_type, created_by, schedule_params, query
            )
        elif (
            schedule_params.name is None
            and schedule_params.cron_expression is None
        ):
            return await self._create_task(task_type, created_by, query, data)
        elif schedule_params.name is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Task name must be provided when scheduling a task.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task cron expression must be provided "
            "when scheduling a task.",
        )
