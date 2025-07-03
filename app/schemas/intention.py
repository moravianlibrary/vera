from datetime import datetime

from pydantic import BaseModel

from adapters.indexer import IndexerModel, IndexerNestedModel
from schemas.project import ProjectSummary


# --------------------
# - Request Payloads -
# --------------------
class IntentionEdit(BaseModel):
    name: str
    description: str | None = None
    target_page_count: int | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None


# --------------------
# - Indexer Entities -
# --------------------
class IntentionSummary(IndexerNestedModel):
    id: int
    name: str


class Intention(IndexerModel):
    class ESConfig:
        index = "intentions"

    id: int

    name: str
    description: str | None

    target_page_count: int | None
    start_date: datetime | None
    end_date: datetime | None

    project: ProjectSummary | None
    is_archived: bool
