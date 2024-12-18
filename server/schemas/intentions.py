from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from datatypes import IntentionClassification
from .base_es_model import BaseEsModel, Integer, Keyword, Date, Float, Text


class IntentionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    target_page_count: Optional[int] = None

    start_date: Optional[date] = None
    end_date: Optional[date] = None
    associated_categories: Optional[List[int]] = None
    # TODO: model validation


class IntentionResponse(IntentionCreate):
    id: int
    classification: IntentionClassification


class IndexIntention(BaseEsModel):
    __index_name__ = "intentions"

    id: Integer
    name: Keyword
    description: Optional[Text] = None
    target_page_count: Optional[Integer] = None

    start_date: Optional[Date] = None
    end_date: Optional[Date] = None
    associated_categories: List[Integer] = []

    classificaton: IntentionClassification
    progress: Optional[Float]
    time_progress: Optional[Float]
