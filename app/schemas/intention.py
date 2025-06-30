from datetime import datetime

from pydantic import BaseModel

from adapters.indexer import Boolean, Date, IndexerEntity, Integer, Keyword
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
class IntentionSummary(IndexerEntity):
    id: Integer
    name: Keyword


class Intention(IndexerEntity):
    description: Keyword | None

    target_page_count: Integer | None
    start_date: Date | None
    end_date: Date | None

    project: ProjectSummary | None
    is_archived: Boolean
