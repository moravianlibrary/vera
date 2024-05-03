from pydantic import BaseModel
from datetime import datetime
from typing import List


class ExtractionDocument(BaseModel):
    id: int
    pages_count: int


class GenerateExtraction(BaseModel):
    include_categories: List[int] = []
    location_ids: List[int] = []
    target_pages_threshold: float = 0.05
    whole_categories_threshold: float = 0.05


class GeneratedExtraction(GenerateExtraction):
    id: int
    document_ids: List[int]
    selected_pages: int
    target_pages: int
    generated_by: str
    generated_at: datetime

    class Config:
        arbitrary_types_allowed = True
        from_attributes = True


class GeneratedExtractions(BaseModel):
    extractions: List[GeneratedExtraction]
    num_found: int
