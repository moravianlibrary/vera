from pydantic import Json

from adapters.indexer import IndexerQuery
from definitions.task import TaskScope, TaskType
from repositories.task import TaskRepository
from schemas.task import Task
from tasks.run import run_task


class TaskService:
    def __init__(self, task_repository: TaskRepository):
        self._task_repository = task_repository

    def init_task(
        self,
        scope: TaskScope,
        task_type: TaskType,
        name: str,
        created_by: str,
        data: Json | None = None,
        query: IndexerQuery | None = None,
    ) -> Task:
        task = self._task_repository.create(
            scope, task_type, name, created_by, data, query
        )

        self._task_repository.index(task, True)

        run_task.delay(task.id)

        return task
