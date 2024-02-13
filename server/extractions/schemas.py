from pydantic import BaseModel
from datetime import datetime
from typing import List

from categories.schemas import CategoryNode


class ExtractionBase(BaseModel):
    pass


class ExtractionCreate(ExtractionBase):
    target_pages_threshold: float = .05
    whole_categories_threshold: float = .05
    include_whole_categories: bool = False
    balance_total_pages: bool = False
    include_categories: List[int] = []


class Extraction(ExtractionBase):
    id: int
    extractor: str
    extracted_at: datetime
    marked: bool
    target_pages: int
    extracted_pages: int
    document_ids: List[int]

    class Config:
        arbitrary_types_allowed = True
        from_attributes = True


class DocumentPagesCount(BaseModel):
    id: int
    pages_count: int


class ExtractionCategoryNode(CategoryNode):
    extracted_pages_count: int
    extracted_documents_count: int


class Extractions(BaseModel):
    extractions: List[Extraction]
    num_found: int
