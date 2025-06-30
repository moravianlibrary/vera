from typing import List

from pydantic import BaseModel

from adapters.indexer import IndexerEntity, Integer, Keyword
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
class GroupSummary(IndexerEntity):
    id: Integer
    name: Keyword
