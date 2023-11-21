from pydantic import BaseModel
from typing import List
from datetime import datetime


class ExtractionBase(BaseModel):
    pass


class ExtractionCreate(ExtractionBase):
    extracted_documents: List[int]


class Extraction(ExtractionBase):
    id: int
    extractor_id: int
    extracted_at: datetime
