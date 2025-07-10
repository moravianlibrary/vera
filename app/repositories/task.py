from typing import Optional

from adapters.database import DatabaseSession
from adapters.indexer import IndexerQuery
from config import VeraConfig
from definitions.json import JsonArray, JsonObject
from definitions.task import (
    TASK_STATE_PREDECESSORS,
    TaskScope,
    TaskState,
    TaskType,
)

from ._base import BaseRepository
from ._database_mixins import GetByIdMixin, PaginationMixin, SaveMixin
from .models.task import TaskModel


class TaskRepository(
    BaseRepository,
    GetByIdMixin[TaskModel, int],
    SaveMixin[TaskModel],
):
    def __init__(self, db_session: DatabaseSession):
        super().__init__(db_session, TaskModel, "Task")

    def create(
        self,
        scope: TaskScope,
        task_type: TaskType,
        name: str,
        created_by: str,
        data: JsonObject | JsonArray | None = None,
        query: IndexerQuery | None = None,
    ) -> TaskModel:
        return self.save_and_index(
            TaskModel(
                task_type=f"{scope}.{task_type}",
                taskname=name,
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
            task_model.started = VeraConfig.Timestamp
        elif task_model.task_state == TaskState.Running:
            task_model.finished = VeraConfig.Timestamp

        task_model.task_state = task_state

        if result_message is not None:
            task_model.result_message = result_message

        return self.save_and_index(task_model)


class TaskItemRepository(
    BaseRepository, SaveMixin[TaskModel], PaginationMixin[TaskModel]
):
    pass


class TaskScheduleRepository(
    BaseRepository,
    SaveMixin[TaskModel],
):
    pass
