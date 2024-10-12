from pydantic import BaseModel

from typing import Dict, List, Optional
from datetime import datetime
from datatypes import (
    TaskState,
    TaskType,
    TaskItemErrorType,
    TaskItemType,
    ElasticsearchParams,
)


# Dataset schema
class Dataset(BaseModel):
    header: List[str]
    items: List[Dict]


# Task schemas
class TaskDefinition(BaseModel):
    id: int
    task_type: TaskType

    owner: str

    query_params: Optional[ElasticsearchParams]

    task_state: TaskState
    planned: datetime
    started: Optional[datetime]
    finished: Optional[datetime]


class TaskError(BaseModel):
    error_type: TaskItemErrorType
    error_message: Optional[str]
    count: int


class TaskOverview(TaskDefinition):
    processed_count: int
    total_count: int
    error_count: int
    errors: List[TaskError] = []

    has_dataset: bool = False
    dataset_error: Optional[str] = None

    class Config:
        arbitrary_types_allowed = True
        from_attributes = True


class TaskItemResponse(BaseModel):
    class Config:
        from_attributes = True

    item_id: str
    item_type: TaskItemType
    deleted: bool

    processed: bool
    error_type: Optional[TaskItemErrorType]
    error_message: Optional[str]


class PeriodicTaskResponse(BaseModel):
    id: int
    task_type: TaskType
    query_params: Optional[ElasticsearchParams]
    minute: int
    hour: Optional[int]
    day_of_week: Optional[int]
    day_of_month: Optional[int]

    # TODO: extended BaseModel for response schemas
    class Config:
        arbitrary_types_allowed = True
        from_attributes = True
