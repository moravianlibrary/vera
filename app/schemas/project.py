from datetime import datetime
from typing import List

from pydantic import BaseModel

from adapters.indexer import (
    Boolean,
    Date,
    Enumerate,
    IndexerEntity,
    Integer,
    Keyword,
)
from definitions.identifier import IdentifierType
from definitions.project import ProjectStatus
from schemas.addition import AdditionBatchParams
from schemas.category import CategorySummary
from schemas.group import GroupSummary
from schemas.user import UserSummary


# --------------------
# - Query Parameters -
# --------------------
class ProjectBatchParams(AdditionBatchParams):
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
class ProjectStatusLog(IndexerEntity):
    status: Enumerate[ProjectStatus]
    message: Keyword | None
    updated_at: Date
    updated_by: Keyword


class ProjectSummary(IndexerEntity):
    id: Integer

    name: Keyword

    created_by: Keyword

    status: Enumerate[ProjectStatus]
    is_archived: Boolean


class Project(ProjectSummary):
    description: Keyword | None

    target_page_count: Integer | None
    start_date: Date | None
    end_date: Date | None

    created_at: Date

    categories: List[CategorySummary]

    groups: List[GroupSummary]
    users: List[UserSummary]

    status_logs: List[ProjectStatusLog]
