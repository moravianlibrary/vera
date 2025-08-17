from typing import List, Optional, Set

from models import Category, Distribution
from pydantic import BaseModel, SerializeAsAny, ValidationInfo, field_validator

from services.exceptions import (
    DistributionExcesiveSubcategoriesException,
    InvalidDistributionSumException,
)

from .base_es_model import BaseEsModel, Text, bool, int, str
from .departments import IndexDepartment


class CategoryResponse(CategoryCreate):
    id: int
    parent_id: Optional[int]
    level: int
    # parent_category: Optional[SerializeAsAny["Category"]]
    sub_categories: List[SerializeAsAny["CategoryResponse"]]
    predecessors_departments: List[int] = []

    total_pages: int
    total_documents: int

    extractable_pages: int
    extractable_documents: int

    intention_id: Optional[int] = None
    percentage: Optional[float] = None
    overall_percentage: Optional[float] = None
    pages_needed_to_meet_intention: Optional[int] = None

    digitization_list_id: Optional[int] = None
    extracted_pages: Optional[int] = None
    extracted_documents: Optional[int] = None

    digitization_ids: Optional[List[int]] = None
    digitized_pages: Optional[int] = None
    digitized_documents: Optional[int] = None


class IndexCategory(BaseEsModel):
    __index__ = "categories"

    id: int
    name: str
    description: Optional[Text] = None

    parent_id: Optional[int] = None
    level: int

    assignable: bool = False
    disabled: bool = False

    direct_to_department: Optional[IndexDepartment] = None
    direct_to_user: Optional[str] = None


Categories = List[SerializeAsAny[CategoryResponse]]


class DistributionCreate(BaseModel):
    category_id: int
    percentage: float

    def load_to_model(
        self, model: Distribution, intention_id: int
    ) -> Distribution:
        model.category_id = self.category_id
        model.percentage = self.percentage
        model.intention_id = intention_id
        return model


class Distribution(DistributionCreate):
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

    def validate_composition(self, subcategories_ids: Set[int]) -> None:
        distributions_ids = set(
            distribution.category_id for distribution in self.distributions
        )

        for category_id in subcategories_ids - distributions_ids:
            self.distributions.append(
                DistributionCreate(category_id=category_id, percentage=0)
            )
        if distributions_ids - subcategories_ids:
            raise DistributionExcesiveSubcategoriesException()


Distributions = List[Distribution]
