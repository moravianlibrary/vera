from datetime import datetime
from typing import List

from pydantic import BaseModel

from adapters.indexer import IndexerModel, IndexerNestedModel
from definitions.document import Priority
from definitions.project import ProjectStatus
from schemas.group import GroupSummary
from schemas.user import UserSummary
from schemas.watchlist import WatchlistSummary


# --------------------
# - Request Payloads -
# --------------------
class ProjectEdit(BaseModel):
    name: str
    description: str | None = None
    target_page_count: int | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None


# --------------------
# - Indexer Entities -
# --------------------
class ProjectStatusLog(IndexerNestedModel):
    status: ProjectStatus
    message: str | None
    updated_at: datetime
    updated_by: str


class ProjectSummary(IndexerNestedModel):
    id: int

    name: str

    created_by: str

    status: ProjectStatus
    is_archived: bool


class Project(IndexerModel):
    class ESConfig:
        index = "projects"
        id_field = "id"

    id: int
    name: str
    description: str | None

    target_page_count: int | None
    start_date: datetime | None
    end_date: datetime | None

    created_by: str
    created_at: datetime

    priority: Priority
    status: ProjectStatus
    is_archived: bool

    groups: List[GroupSummary]
    users: List[UserSummary]

    status_log: List[ProjectStatusLog]

    watchlists: List[WatchlistSummary] = []
