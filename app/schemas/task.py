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
from schemas.common import Notification

InputStringField = Field(None, min_length=1, max_length=256)


# --------------------
# - Query Parameters -
# --------------------
class TaskScheduleParams(BaseModel):
    schedule_name: str | None = InputStringField
    cron_expression: str | None = InputStringField


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


class TaskNotificationSummary(BaseModel):
    id: int
    task_type: ScopedTaskType
    name: str
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    result: List["TaskResult"] | None


class TaskNotification(Notification):
    previous_state: TaskState
    new_state: TaskState
    task: TaskNotificationSummary


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


class TaskData(IndexerNestedModel):
    class Config:
        extra = "allow"


class TaskScheduleHit(IndexerModel):
    name: keyword
    cron_expression: keyword

    task_type: ScopedTaskType
    query: IndexerQuery | None = None
    data: TaskData | None = None

    task_scope: TaskScope
    unscoped_task_type: EnumUnion[TaskType]


class TaskSchedule(TaskScheduleHit):
    class ESConfig:
        index = "task_schedules"
        id_field = "id"

    id: integer


TaskOrSchedule = Task | TaskSchedule
