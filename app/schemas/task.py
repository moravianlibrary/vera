from pydantic import BaseModel, Field


# --------------------
# - Query Parameters -
# --------------------
class TaskScheduleParams(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    cron_expression: str = Field(..., min_length=1, max_length=100)


class TaskItemsFilterParams(BaseModel):
    pass


# --------------------
# - Indexer Entities -
# --------------------
class Task(BaseModel):
    pass


class TaskItem(BaseModel):
    pass


class ScheduledTask(BaseModel):
    pass
