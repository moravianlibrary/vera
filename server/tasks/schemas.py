from pydantic import BaseModel

from typing import List, Optional
from datetime import datetime
from tasks.enums import TaskState, TaskType, TaskDocumentErrorType


class TaskBase(BaseModel):
    task_type: TaskType


class TaskCreate(TaskBase):
    pass


class TaskCreation(TaskBase):
    id: int

    owner: str
    query: str

    task_state: TaskState
    planned: datetime
    started: Optional[datetime]
    finished: Optional[datetime]


class TaskError(BaseModel):
    error_type: TaskDocumentErrorType
    error_message: Optional[str]
    count: int


class Task(TaskCreation):
    processed_count: int
    total_count: int
    error_count: int
    errors: List[TaskError] = []


class TaskDocument(BaseModel):
    document_id: int
    deleted: bool

    processed: bool
    error_type: Optional[TaskDocumentErrorType]
    error_message: Optional[str]
