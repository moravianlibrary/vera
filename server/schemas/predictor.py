from pydantic import BaseModel
from typing import Optional


class PredictPeriodicalPageCount(BaseModel):
    title: Optional[str]
    year: Optional[int]
    frequency: Optional[int]
    publisher: Optional[str]
    language: Optional[str]
    region: Optional[str]
    keywords: Optional[str]
