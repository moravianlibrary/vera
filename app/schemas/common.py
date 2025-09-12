from datetime import datetime
from typing import Generic, List, TypeVar

from pydantic import BaseModel, Field

from definitions.document import Priority, PriorityField


# --------------------
# - Query Parameters -
# --------------------
class PageParams(BaseModel):
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(50, ge=1, le=100, description="Page size")

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


class FilterParams(BaseModel):
    created_by: List[str] = []


class UserIdFilterParams(BaseModel):
    user_id: str


class BatchParams(BaseModel):
    batch_id: int | None = None
    batch_name: str | None = None
    file_name: str | None = None


# --------------------
# - Request Payloads -
# --------------------
class UserAssignment(BaseModel):
    users: List[str] = []


class Assignment(UserAssignment):
    groups: List[int] = []


class UserAssignmentChange(BaseModel):
    add: UserAssignment | None = None
    remove: UserAssignment | None = None


class AssignmentChange(BaseModel):
    add: Assignment | None = None
    remove: Assignment | None = None


class Message(BaseModel):
    message: str


class PriorityChange(BaseModel):
    priority: Priority = PriorityField


# -----------------
# - API Responses -
# -----------------
Item = TypeVar("Item", bound=BaseModel)


class Page(BaseModel, Generic[Item]):
    items: List[Item]
    num_found: int


class Notification(BaseModel):
    id: int
    created_at: datetime
    read_at: datetime | None


class Count(BaseModel):
    count: int
