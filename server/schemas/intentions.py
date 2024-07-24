from pydantic import BaseModel
from typing import Optional
from datetime import date
from datatypes import IntentionClassification


class IntentionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    target_page_count: int
    start_date: date
    end_date: date


class IntentionResponse(IntentionCreate):
    id: int
    classification: IntentionClassification
