from typing import List, Optional

from pydantic import BaseModel

from adapters.indexer import Date, Enumerate, IndexerEntity, Integer, Keyword
from definitions.digitization_registry import (
    DigitizationListState,
    DigitizationState,
)
from schemas.intention import IntentionSummary


# --------------------
# - Query Parameters -
# --------------------
class CreateDigitizationListParams(BaseModel):
    intention_ids: List[int] = []
    state: DigitizationListState | None = None
    skip_state_validation_for: List[DigitizationState] = []


# --------------------
# - Indexer Entities -
# --------------------
class DigitizationList(IndexerEntity):
    id: Integer

    state: Enumerate[DigitizationState]
    intentions: List[IntentionSummary]

    count_documents: Integer
    count_pages: Integer

    created_at: Date
    created_by: Keyword


# ----------------
# - Task Results -
# ----------------
class CreateDigitizationListResponse(BaseModel):
    digitization_list: Optional[DigitizationList]
    already_in_list: int
    ignored_by_state: int
    added: int


class AddDocumentsResponse(BaseModel):
    digitization_list: DigitizationList
    already_in_this_list: int
    already_in_other_list: int
    ignored_by_state: int
    added: int


class RemoveDocumentsResponse(BaseModel):
    digitization_list: DigitizationList
    not_in_any_list: int
    not_in_this_list: int
    removed: int
