from typing import List

from pydantic import BaseModel

from adapters.indexer import IndexerNestedModel
from schemas.common import PageParams


# --------------------
# - Query Parameters -
# --------------------
class FilteredPageParams(PageParams):
    username: str | None = None


# --------------------
# - Request Payloads -
# --------------------
class UserSettings(BaseModel):
    class Config:
        extra = "allow"


# -----------------
# - API Responses -
# -----------------
class UserAssignment(BaseModel):
    user_id: str
    group_ids: List[int]


class UserOverview(BaseModel):
    id: str
    username: str
    email: str


# --------------------
# - Indexer Entities -
# --------------------
class UserSummary(IndexerNestedModel):
    id: str
    username: str
