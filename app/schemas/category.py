from typing import List

from pydantic import BaseModel, model_validator

from adapters.indexer import Boolean, Float, IndexerEntity, Integer, Keyword
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
class CategoryProportion(IndexerEntity):
    distribution_id: Integer
    proportion: Float
    overall_proportion: Float


class DocumentDiscovery(IndexerEntity):
    id: Integer
    scheduled_task_id: Integer | None


class CategorySummary(IndexerEntity):
    id: Integer

    name: Keyword
    parent_id: Integer | None

    assignable: Boolean
    disabled: Boolean


class Category(IndexerEntity):
    description: Keyword | None
    level: Integer

    extract_whole: Boolean
    archived: Boolean

    assigned_groups: List[GroupSummary]
    assigned_users: List[UserSummary]
    indirect_groups: List[GroupSummary]
    indirect_users: List[UserSummary]

    proportions: List[CategoryProportion]

    count_total_pages: Integer
    count_total_documents: Integer
    count_extractable_pages: Integer
    count_extractable_documents: Integer
    count_extracted_pages: Integer
    count_extracted_documents: Integer

    document_discovery: DocumentDiscovery | None
