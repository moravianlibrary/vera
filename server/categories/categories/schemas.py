from pydantic import (
    BaseModel,
    SerializeAsAny,
    field_validator,
    ValidationInfo,
)
from typing import List, Optional

from services.exceptions import InvalidDistributionSumException


class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    assignable: bool = False
    extract_whole: bool = False
    disabled: bool = False
    departments: List[int] = []


class CategoryCreate(CategoryBase):
    pass


class Category(CategoryBase):
    id: int
    parent_id: Optional[int]
    level: int
    # parent_category: Optional[SerializeAsAny["Category"]]
    sub_categories: List[SerializeAsAny["Category"]]
    predecessors_departments: List[int] = []

    total_pages: int
    total_documents: int

    documents_with_pages: int
    documents_without_cnb: int

    extractable_pages: int
    extractable_documents: int

    intention_id: Optional[int] = None
    percentage: Optional[float] = None
    overall_percentage: Optional[float] = None
    pages_needed_to_meet_intention: Optional[int] = None

    extraction_id: Optional[int] = None
    extracted_pages: Optional[int] = None
    extracted_documents: Optional[int] = None

    digitization_ids: Optional[List[int]] = None
    digitized_pages: Optional[int] = None
    digitized_documents: Optional[int] = None


Categories = List[Category]


class DistributionBase(BaseModel):
    category_id: int
    percentage: float


class DistributionCreate(DistributionBase):
    pass


class Distribution(DistributionBase):
    intention_id: int
    pages_needed_to_meet_intention: int


class DistributionList(BaseModel):
    intention_id: int
    distributions: List[DistributionCreate]

    @field_validator("distributions")
    @classmethod
    def validate_distribution(
        cls, distributions: List[DistributionCreate], info: ValidationInfo
    ) -> int:
        total_percentage = sum(
            distribution.percentage for distribution in distributions
        )
        if total_percentage != 100:
            raise InvalidDistributionSumException()
        return distributions


Distributions = List[Distribution]
