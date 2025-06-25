from typing import List

from pydantic import BaseModel, model_validator

from .group import GroupSummary


class CategoryEdit(BaseModel):
    name: str
    description: str | None = None
    assignable: bool = False
    disabled: bool = False
    extract_whole: bool = False


class CategoryParentChangeParams(BaseModel):
    from_parent_id: int | None = None
    to_parent_id: int | None = None

    @model_validator(mode="after")
    def validate_different_parents(
        cls, model: "CategoryParentChangeParams"
    ) -> "CategoryParentChangeParams":
        if model.from_parent_id == model.to_parent_id:
            raise ValueError(
                "from_parent_id and to_parent_id must be different."
            )
        return model


class Category(CategoryEdit):
    id: int
    parent_id: int | None
    level: int
    intention_id: int | None
    archived: bool
    assigned_groups: List[GroupSummary]
    assigned_users: List[str]
    indirect_groups: List[GroupSummary]
    indirect_users: List[str]
    # +hasScript: Boolean
    # +hasRecurringTask: Boolean
    # +distributions: List<CategoryDistribution>
    # +countTotalPages: Integer
    # +countTotalDocuments: Integer
    # +countExtractablePages: Integer
    # +countExtractableDocuments: Integer
    # +countExtractedPages: Integer
    # +countExtractedDocuments: Integer


class CategoryProportion(BaseModel):
    category_id: int
    proportion: float


class CategoryProportionNode(CategoryProportion):
    children: List["CategoryProportionNode"] = []


class DistributionEdit(BaseModel):
    name: str
    description: str | None = None


class Distribution(DistributionEdit):
    id: int
    is_active: bool


class DistributionEditWithProportions(DistributionEdit):
    proportions: List[CategoryProportionNode]
