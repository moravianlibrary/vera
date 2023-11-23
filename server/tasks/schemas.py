from pydantic import BaseModel

from typing import Optional
from datetime import datetime
from tasks.enums import TaskScope, TaskState, TaskType


class TaskBase(BaseModel):
    task_type: TaskType
    task_scope: TaskScope


class TaskCreate(TaskBase):
    pass


class TaskCreation(TaskBase):
    id: int

    owner_id: int
    owner_name: str

    task_state: TaskState
    planned: datetime
    started: Optional[datetime]
    finished: Optional[datetime]


class Task(TaskCreation):
    processed_count: int
    total_count: int
