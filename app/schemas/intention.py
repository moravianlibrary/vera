from datetime import datetime

from pydantic import BaseModel


class IntentionEdit(BaseModel):
    name: str
    description: str | None = None
    target_page_count: int | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None


class Intention(IntentionEdit):
    project_id: int | None = None
    is_archived: bool = False

    class Config:
        from_attributes = True
