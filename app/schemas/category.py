from datetime import datetime
from decimal import Decimal
from typing import List

from pydantic import BaseModel, Field

from adapters.database import ModelValidateWithViewsMixin
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


# --------------------
# - Request Payloads -
# --------------------
class CategoryEdit(BaseModel):
    name: str
    description: str | None = None
    assignable: bool = False
    disabled: bool = False
    extract_whole: bool = False


class CategoryProportionEdit(BaseModel):
    category_id: int
    proportion: Decimal = Field(..., gt=0, lt=1, decimal_places=4)


class CategoryProportionNode(CategoryProportionEdit):
    children: List["CategoryProportionNode"] = []


class DistributionInfoEdit(BaseModel):
    name: str
    description: str | None = None


class DistributionProportionsEdit(BaseModel):
    root_proportions: List[CategoryProportionNode]


# -----------------
# - API Responses -
# -----------------
class Distribution(DistributionInfoEdit):
    id: int
    is_active: bool


# --------------------
# - Indexer Entities -
# --------------------
class PathNode(BaseModel):
    id: int
    name: str


class CategorySummary(IndexerNestedModel):
    id: int

    name: str
    path: List[PathNode]

    assignable: bool
    disabled: bool


class CategoryProportion(IndexerNestedModel):
    distribution_id: int
    proportion: float
    overall_proportion: float


class CategoryHit(IndexerModel):
    name: str
    description: str | None = None
    parent_id: int | None = None
    level: Level
    path: List[PathNode]

    assignable: bool
    extract_whole: bool
    disabled: bool
    archived: bool

    document_discovery_id: int | None = None
    document_discovery_schedule_id: int | None = None

    proportions: List[CategoryProportion]

    count_total_pages: int
    count_total_documents: int
    count_extractable_pages: int
    count_extractable_documents: int
    count_extracted_pages: int
    count_extracted_documents: int

    direct_groups: List[GroupSummary]
    direct_users: List[UserSummary]
    effective_groups: List[GroupSummary]
    effective_users: List[UserSummary]

    created_at: datetime


class Category(CategoryHit, ModelValidateWithViewsMixin):
    class ESConfig:
        index = "categories"
        id_field = "id"

    id: int


class DocumentDiscoveryTaskData(BaseModel):
    category_id: int
    plugin_instance_id: int
