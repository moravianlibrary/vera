from typing import Optional

from pydantic import BaseModel

from adapters.indexer import IndexerQuery
from config import config
from definitions.task import (
    TASK_STATE_PREDECESSORS,
    TaskScope,
    TaskState,
    TaskType,
)
from schemas.task import Task, TaskSchedule

from ._db_indexed_repository import DbIndexedRepository
from ._db_repository import DbRepository, GetByIdMixin, PaginationMixin
from .models.task import TaskModel, TaskScheduleModel


class TaskRepository(
    DbIndexedRepository[TaskModel, Task],
    GetByIdMixin[TaskModel, int],
):
    _entity_name = "Task"
    _db_model = TaskModel
    _indexer_model = Task

    async def create(
        self,
        scope: TaskScope,
        task_type: TaskType,
        name: str,
        created_by: str,
        query: IndexerQuery | None = None,
        data: BaseModel | None = None,
    ) -> TaskModel:
        return await self.save(
            TaskModel(
                task_type=f"{scope.value}.{task_type.value}",
                name=name,
                created_by=created_by,
                query=query.model_dump(mode="json") if query else None,
                data=data.model_dump(mode="json") if data else None,
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
    DbIndexedRepository[TaskScheduleModel, TaskSchedule],
    GetByIdMixin[TaskScheduleModel, int],
):
    _entity_name = "Task Schedule"
    _db_model = TaskScheduleModel
    _indexer_model = TaskSchedule

    async def create(
        self,
        scope: TaskScope,
        task_type: TaskType,
        name: str,
        cron_expression: str,
        created_by: str,
        query: IndexerQuery | None = None,
        data: BaseModel | None = None,
    ) -> TaskScheduleModel:
        return await self.save(
            TaskScheduleModel(
                task_type=f"{scope.value}.{task_type.value}",
                name=name,
                cron_expression=cron_expression,
                created_by=created_by,
                query=query.model_dump(mode="json") if query else None,
                data=data.model_dump(mode="json") if data else None,
            )
        )

    async def update(
        self, task_schedule: TaskScheduleModel, name: str, cron_expression: str
    ) -> TaskScheduleModel:
        task_schedule.name = name
        task_schedule.cron_expression = cron_expression
        return await self.save(task_schedule)

    async def update_query(
        self, task_schedule: TaskScheduleModel, query: IndexerQuery | None
    ) -> TaskScheduleModel:
        task_schedule.query = query.model_dump() if query else None
        return await self.save(task_schedule)
