from datetime import datetime
from typing import List

from pydantic import BaseModel

from definitions.identifier import IdentifierType
from definitions.project import ProjectStatus
from schemas.addition import AdditionBatchParams
from schemas.group import GroupSummary
from schemas.user import User


class ProjectBatchParams(AdditionBatchParams):
    pass


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


class ProjectStatusLog(BaseModel):
    status: ProjectStatus
    message: str | None
    updated_at: datetime
    updated_by: str


class Project(ProjectEdit):
    id: int

    created_at: datetime
    created_by: str

    status: ProjectStatus
    is_archived: bool

    status_logs: List[ProjectStatusLog]

    groups: List[GroupSummary]
    users: List[User]
    users: List[User]
