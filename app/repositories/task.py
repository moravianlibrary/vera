from requests import Session

from adapters.indexer import IndexerQuery
from definitions.json import JsonArray, JsonObject
from definitions.task import TaskScope, TaskType

from ._base import BaseRepository
from ._mixins import GetByIdMixin, SaveMixin
from .models.task import TaskModel


class TaskRepository(
    BaseRepository,
    GetByIdMixin[TaskModel, str],
    SaveMixin[TaskModel, str],
):
    def __init__(self, db_session: Session):
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
        return self.save(
            TaskModel(
                task_type=f"{scope}.{task_type}",
                taskname=name,
                created_by=created_by,
                data=data,
                query=query.to_dict() if query else None,
            )
        )
