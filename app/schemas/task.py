from datetime import datetime
from typing import List

from esorm.fields import integer, keyword
from pydantic import BaseModel, Field

from adapters.indexer import (
    EnumUnion,
    IndexerModel,
    IndexerNestedModel,
    IndexerQuery,
)
from definitions.task import ScopedTaskType, TaskScope, TaskState, TaskType


# --------------------
# - Query Parameters -
# --------------------
class TaskScheduleParams(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=50)
    cron_expression: str | None = Field(None, min_length=1, max_length=100)


class TaskItemsFilterParams(BaseModel):
    processed: bool | None = None
    with_error: bool | None = None


# -----------------
# - API Responses -
# -----------------
class TaskItem(BaseModel):
    addition_id: int | None
    catalog_record_id: str | None
    category_id: int | None
    digitization_list_id: int | None
    document_iteration_id: int | None
    proposal_id: int | None

    processed: bool
    error_message: str | None


# --------------------
# - Indexer Entities -
# --------------------
class TaskResult(IndexerNestedModel):
    metric: str
    value: int


class TaskHit(IndexerModel):
    task_type: ScopedTaskType
    task_scope: TaskScope
    unscoped_task_type: EnumUnion[TaskType]
    name: keyword

    task_schedule_id: integer | None = None
    created_by: keyword

    has_query: bool
    has_data: bool

    task_state: TaskState

    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None

    processed_count: integer
    total_count: integer
    error_count: integer

    result: List[TaskResult] | None = None


class Task(TaskHit):
    class ESConfig:
        index = "tasks"
        id_field = "id"

    id: integer


class TaskScheduleHit(IndexerModel):
    name: keyword

    task_type: ScopedTaskType
    task_scope: TaskScope
    unscoped_task_type: EnumUnion[TaskType]

    query: IndexerQuery | None = None
    cron_expression: keyword


class TaskSchedule(TaskScheduleHit):
    class ESConfig:
        index = "task_schedules"
        id_field = "id"

    id: integer


TaskOrSchedule = Task | TaskSchedule
