from typing import List

from esorm import ESBaseModel
from pydantic import BaseModel

from schemas.user import UserSummary


# --------------------
# - Request Payloads -
# --------------------
class GroupEdit(BaseModel):
    name: str
    description: str | None = None


class GroupAssignmentChange(BaseModel):
    add: List[str] | None = None
    remove: List[str] | None = None


# -----------------
# - API Responses -
# -----------------
class Group(GroupEdit):
    id: int
    name: str
    description: str | None
    users: List[UserSummary]

    class Config:
        from_attributes = True


# --------------------
# - Indexer Entities -
# --------------------
class GroupSummary(ESBaseModel):
    id: int
    name: str
