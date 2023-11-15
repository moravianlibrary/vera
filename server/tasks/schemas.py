from pydantic import BaseModel

from typing import Optional
from datetime import datetime
from tasks.enums import TaskScope, TaskState, TaskType


class QueryPart(BaseModel):
    field: str
    


class TaskBase(BaseModel):
    task_type: TaskType
    task_scope: TaskScope
    query: Optional[str]


class TaskCreate(TaskBase):
    pass


class Task(TaskBase):
    id: int

    owner_id: int
    owner_name: str

    task_state: TaskState
    planned: datetime
    started: datetime
    finished: datetime

    processed_count: int
    total_count: int
