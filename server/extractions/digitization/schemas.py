from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class DigitizationList(BaseModel):
    id: int
    document_ids: List[int]
    extracted_pages: int
    intention_id: Optional[int]
    extractor: str
    extracted_at: datetime

    class Config:
        arbitrary_types_allowed = True
        from_attributes = True


class DigitizationLists(BaseModel):
    extractions: List[DigitizationList]
    num_found: int
