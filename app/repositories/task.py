from typing import Optional

from adapters.database import DatabaseSession
from adapters.indexer import IndexerQuery, IndexerSession
from config import config
from definitions.json import JsonArray, JsonObject
from definitions.task import (
    TASK_STATE_PREDECESSORS,
    TaskScope,
    TaskState,
    TaskType,
)
from schemas.task import Task

from ._db_indexed_repository import DbIndexedRepository
from ._db_repository import DbRepository, GetByIdMixin, PaginationMixin
from .models.task import TaskModel


class TaskRepository(
    DbIndexedRepository[TaskModel, Task],
    GetByIdMixin[TaskModel, int],
):
    def __init__(
        self, db_session: DatabaseSession, indexer_session: IndexerSession
    ):
        super().__init__("Task", db_session, TaskModel, indexer_session, Task)

    async def create(
        self,
        scope: TaskScope,
        task_type: TaskType,
        name: str,
        created_by: str,
        data: JsonObject | JsonArray | None = None,
        query: IndexerQuery | None = None,
    ) -> TaskModel:
        return await self.save(
            TaskModel(
                task_type=f"{scope.value}.{task_type.value}",
                name=name,
                created_by=created_by,
                data=data,
                query=query.to_dict() if query else None,
            )
        )

    def update_state(
        self,
        task_model: TaskModel,
        task_state: TaskState,
        result_message: Optional[str] = None,
    ) -> TaskModel:
        if task_model.task_state not in TASK_STATE_PREDECESSORS[task_state]:
            # TODO: Use http exception
            raise Exception()

        if task_state == TaskState.Running:
            task_model.started_at = config.timestamp
        elif task_model.task_state == TaskState.Running:
            task_model.finished_at = config.timestamp

        task_model.task_state = task_state

        if result_message is not None:
            task_model.result_message = result_message

        return self.save(task_model)


class TaskItemRepository(DbRepository[TaskModel], PaginationMixin[TaskModel]):
    pass


class TaskScheduleRepository(
    DbRepository[TaskModel],
):
    pass
