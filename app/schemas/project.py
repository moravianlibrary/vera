from datetime import datetime
from typing import List

from pydantic import BaseModel

from adapters.indexer import IndexerModel, IndexerNestedModel
from definitions.identifier import IdentifierType
from definitions.project import ProjectStatus
from schemas.addition import AdditionsBatchParams
from schemas.category import CategorySummary
from schemas.group import GroupSummary
from schemas.user import UserSummary
from schemas.watchlist import WatchlistSummary


# --------------------
# - Query Parameters -
# --------------------
class ProjectBatchParams(AdditionsBatchParams):
    pass


# --------------------
# - Request Payloads -
# --------------------
class ProjectEdit(BaseModel):
    name: str
    description: str | None = None
    target_page_count: int | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None


class ProjectAdditionCreate(BaseModel):
    identifier_type: IdentifierType
    identifier_value: str
    category_id: int | None = None


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


class ProjectHit(IndexerModel):
    name: str
    description: str | None

    target_page_count: int | None
    start_date: datetime | None
    end_date: datetime | None

    created_by: str
    created_at: datetime

    status: ProjectStatus
    is_archived: bool

    categories: List[CategorySummary]

    groups: List[GroupSummary]
    users: List[UserSummary]

    status_log: List[ProjectStatusLog]

    watchlists: List[WatchlistSummary] = []


class Project(ProjectHit):
    class ESConfig:
        index = "projects"

    id: int
