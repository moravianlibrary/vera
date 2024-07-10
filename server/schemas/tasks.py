from pydantic import BaseModel

from typing import Dict, List, Optional
from datetime import datetime
from tasks.types import TaskState, TaskType, TaskDocumentErrorType


# Dataset schema
class Dataset(BaseModel):
    header: List[str]
    items: List[Dict]


# Task schemas
class TaskCreate(BaseModel):
    task_type: TaskType


class TaskDefinition(TaskCreate):
    id: int

    owner: str

    query: Optional[str]

    task_state: TaskState
    planned: datetime
    started: Optional[datetime]
    finished: Optional[datetime]


class TaskError(BaseModel):
    error_type: TaskDocumentErrorType
    error_message: Optional[str]
    count: int


class Task(TaskDefinition):
    processed_count: int
    total_count: int
    error_count: int
    errors: List[TaskError] = []

    has_dataset: bool = False
    dataset_error: Optional[str] = None


class TaskDocument(BaseModel):
    document_id: int
    deleted: bool

    processed: bool
    error_type: Optional[TaskDocumentErrorType]
    error_message: Optional[str]
