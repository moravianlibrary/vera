from pydantic import BaseModel
from typing import List, Optional
from datetime import date

from categories.intentions.types import IntentionClassification


class IntentionBase(BaseModel):
    name: str
    description: Optional[str] = None
    target_page_count: int
    start_date: date
    end_date: date
    classification: IntentionClassification


class IntentionCreate(IntentionBase):
    pass


class Intention(IntentionBase):
    id: int


Intentions = List[Intention]
