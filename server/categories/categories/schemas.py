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


class CategoryCreate(CategoryBase):
    pass


class Category(CategoryBase):
    id: int
    parent_id: Optional[int]
    level: int
    departments: List[int]
    # parent_category: Optional[SerializeAsAny["Category"]]
    sub_categories: List[SerializeAsAny["Category"]]

    total_pages: int
    total_documents: int

    documents_with_pages: int
    documents_without_cnb: int

    extractable_pages: int
    extractable_documents: int


class CategoryIntentionReport(Category):
    intention_id: int
    percentage: float
    pages_needed_to_meet_intention: int


class CategoryExtractReport(Category):
    extraction_id: int
    extracted_pages: int
    extracted_documents: int


class CategoryDigitizationReport(Category):
    digitization_ids: List[int]
    digitized_pages: int
    digitized_documents: int


Categories = List[Category]


class DistributionBase(BaseModel):
    category_id: int
    percentage: float


class DistributionCreate(DistributionBase):
    pass


class Distribution(DistributionBase):
    intention_id: int


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
