from pydantic import BaseModel, field_validator, ValidationInfo
from datetime import datetime
from typing import List, Set
from exceptions import EmptyExtractionException
from datatypes import DigitizationState


class ExtractionDocument(BaseModel):
    id: int
    pages_count: int


class GenerateExtraction(BaseModel):
    target_pages: int
    ignore_digitization_states: Set[DigitizationState] = set()
    include_categories: List[int] = []
    location_ids: List[int] = []
    target_pages_threshold: float = 0.05
    whole_categories_threshold: float = 0.05

    @field_validator("target_pages")
    @classmethod
    def validate_distribution(
        cls, target_pages: int, info: ValidationInfo
    ) -> int:
        if target_pages <= 0:
            raise EmptyExtractionException()
        return target_pages


class ExtractionResponse(GenerateExtraction):
    id: int
    document_ids: List[int]
    selected_pages: int
    generated_by: str
    generated_at: datetime

    class Config:
        arbitrary_types_allowed = True
        from_attributes = True
