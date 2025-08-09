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
from repositories.models.task import TaskModel, TaskScheduleModel
from repositories.task import TaskRepository
from schemas.authenticated_user import AuthenticatedUser
from schemas.common import UserAssignment
from schemas.task import Task, TaskScheduleParams
from tasks.entrypoint import init_task


class TaskService:
    def __init__(self, task_repository: TaskRepository):
        self._task_repository = task_repository

    def _enforce_read_ownership(self, task_id: int, user: str) -> TaskModel:
        pass

    def _enforce_manage_ownership(self, task_id: int, user: str) -> TaskModel:
        pass

    def serialize_entity(self, task: TaskModel) -> Task:
        return self._task_repository.serialize_entity(task)

    async def create(
        self,
        scope: TaskScope,
        task_type: TaskType,
        name: str,
        created_by: str,
        data: BaseModel | None = None,
        query: IndexerQuery | None = None,
    ) -> TaskModel:
        task = await self._task_repository.create(
            scope,
            task_type,
            name,
            created_by,
            data.model_dump(mode="json") if data else None,
            query,
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
    def create():
        pass

    def update(
        task_schedule: TaskScheduleModel,
        params: TaskScheduleParams,
        assignment: UserAssignment,
    ):
        pass


class TaskBasedService:
    _task_scope: TaskScope | None = None
    _task_names_mapping: Dict[TaskType, str] | None = None

    def __init__(self, task_repository: TaskRepository):
        self._task_service = TaskService(task_repository)

    async def _create_task(
        self,
        task_type: TaskType,
        created_by: str,
        data: BaseModel | None = None,
        query: IndexerQuery | None = None,
    ) -> TaskModel:
        return await self._task_service.create(
            self._task_scope,
            task_type,
            self._task_names_mapping[task_type],
            created_by,
            data,
            query,
        )

    def _serialize_task(self, task: TaskModel) -> Task:
        return self._task_service.serialize_entity(task)
