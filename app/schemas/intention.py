from datetime import datetime

from esorm import ESBaseModel, ESModel
from pydantic import BaseModel

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
class IntentionSummary(ESBaseModel):
    id: int
    name: str


class Intention(ESModel):
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
