from pydantic import BaseModel
from datetime import datetime
from typing import List


class ExtractionBase(BaseModel):
    pass


class ExtractionCreateBase(ExtractionBase):
    target_pages_threshold: float = .05
    whole_categories_threshold: float = .05
    include_whole_categories: bool = False
    balance_total_pages: bool = False
    include_categories: List[int] = []


class ExtractionCreatePreview(ExtractionCreateBase):
    pages_count: int


class ExtractionCreate(ExtractionCreateBase):
    quota_id: int


class Extraction(ExtractionBase):
    id: int
    extractor: str
    extracted_at: datetime
    document_ids: List[int]


class DocumentPagesCount(BaseModel):
    id: int
    pages_count: int
