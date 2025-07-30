from datetime import datetime
from typing import Dict

from esorm.fields import integer, keyword
from pydantic import BaseModel, Field

from adapters.indexer import IndexerModel, IndexerQuery
from definitions.task import TaskScope, TaskState, TaskType


# --------------------
# - Query Parameters -
# --------------------
class TaskScheduleParams(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    cron_expression: str = Field(..., min_length=1, max_length=100)


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
class Task(IndexerModel):
    id: integer
    task_schedule_id: integer | None

    # TODO: Cant be Union
    # task_type: TaskType
    task_scope: TaskScope
    unscoped_task_type: keyword
    name: keyword

    task_state: TaskState

    created_by: keyword

    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None

    processed_count: integer
    total_count: integer
    error_count: integer

    # TODO: Cant be TypedDict
    # query: IndexerQuery
    # TODO:
    # result: Dict[str, int] | None


class ScheduledTask(IndexerModel):
    id: integer
    name: keyword

    # TODO:
    # task_type: TaskType
    task_scope: TaskScope
    unscoped_task_type: keyword

    # TODO:
    # query: IndexerQuery
    cron_expression: keyword
