from pydantic import BaseModel


class MessageResponse(BaseModel):
    message: str


class TaskMessageResponse(BaseModel):
    status_code: int
    message: str
    # TODO:
    task_id: str | None = None
    task_name: str | None = None
