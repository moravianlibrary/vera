from typing import Dict

from pydantic import BaseModel

from adapters.indexer import IndexerQuery
from definitions.task import TaskScope, TaskType
from repositories.models.task import TaskModel
from repositories.task import TaskRepository


class TaskService:
    def __init__(self, task_repository: TaskRepository):
        self._task_repository = task_repository

    def create_task(
        self,
        scope: TaskScope,
        task_type: TaskType,
        name: str,
        created_by: str,
        data: BaseModel | None = None,
        query: IndexerQuery | None = None,
    ) -> TaskModel:
        task = self._task_repository.create(
            scope,
            task_type,
            name,
            created_by,
            data.model_dump() if data else None,
            query,
        )

        self._task_repository.index(task, True)

        run_task.delay(task.id)

        return task


class ScheduledTaskService:
    pass


class TaskBasedService:
    _task_scope: TaskScope | None = None
    _task_names_mapping: Dict[TaskType, str] | None = None

    def __init__(self, task_service: TaskService):
        self._task_service = task_service

    def _create_task(
        self,
        task_type: TaskType,
        created_by: str,
        data: BaseModel | None = None,
        query: IndexerQuery | None = None,
    ) -> TaskModel:
        return self._task_service.create_task(
            self._task_scope,
            task_type,
            self._task_names_mapping[task_type],
            created_by,
            data,
            query,
        )
