from typing import List

from pydantic import BaseModel, model_validator

from adapters.indexer import IndexerModel, IndexerNestedModel
from definitions.category import Level
from schemas.group import GroupSummary
from schemas.user import UserSummary


# --------------------
# - Query Parameters -
# --------------------
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


# --------------------
# - Request Payloads -
# --------------------
class CategoryEdit(BaseModel):
    name: str
    description: str | None = None
    assignable: bool = False
    disabled: bool = False
    extract_whole: bool = False


# --------------------
# - Indexer Entities -
# --------------------
class CategorySummary(IndexerNestedModel):
    id: int

    name: str
    path_id: List[int]
    path_name: List[str]

    assignable: bool
    disabled: bool


class CategoryProportion(IndexerNestedModel):
    distribution_id: int
    proportion: float
    overall_proportion: float


class DocumentDiscovery(IndexerNestedModel):
    id: int
    task_schedule_id: int | None


class Category(IndexerModel):
    class ESConfig:
        index = "categories"

    id: int

    name: str
    description: str | None
    parent_id: int | None
    level: Level

    assignable: bool
    extract_whole: bool
    disabled: bool
    archived: bool

    assigned_groups: List[GroupSummary]
    assigned_users: List[UserSummary]
    indirect_groups: List[GroupSummary]
    indirect_users: List[UserSummary]

    proportions: List[CategoryProportion]

    count_total_pages: int
    count_total_documents: int
    count_extractable_pages: int
    count_extractable_documents: int
    count_extracted_pages: int
    count_extracted_documents: int

    document_discovery: DocumentDiscovery | None
