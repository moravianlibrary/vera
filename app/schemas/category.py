from typing import List

from pydantic import BaseModel

from .group import GroupSummary


class CategoryEdit(BaseModel):
    name: str
    description: str | None = None
    assignable: bool = False
    disabled: bool = False


class Category(CategoryEdit):
    id: int
    parentId: int | None
    level: int
    intentionId: int | None
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
