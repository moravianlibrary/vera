from typing import Generic, List, TypeVar

from pydantic import BaseModel, Field


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


# TODO: remove ?
class FilterParams(BaseModel):
    created_by: List[str] = []


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


# -----------------
# - API Responses -
# -----------------
Item = TypeVar("Item", bound=BaseModel)


class Page(BaseModel, Generic[Item]):
    items: List[Item]
    num_found: int
