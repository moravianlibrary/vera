from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class DigitizationList(BaseModel):
    id: int
    document_ids: List[int]
    page_count: int
    intention_id: Optional[int]
    created_by: str
    created_at: datetime

    class Config:
        arbitrary_types_allowed = True
        from_attributes = True


class DigitizationLists(BaseModel):
    extractions: List[DigitizationList]
    num_found: int
