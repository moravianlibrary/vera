from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from adapters.database import ModelValidateWithViewsMixin
from adapters.indexer import IndexerModel
from definitions.digitization_registry import (
    DigitizationListState,
    DigitizationState,
)
from schemas.intention import IntentionSummary


# --------------------
# - Request Payloads -
# --------------------
class ChangeStateRequest(BaseModel):
    state: DigitizationListState


# --------------------
# - Query Parameters -
# --------------------
class CreateDigitizationListParams(BaseModel):
    intention_ids: List[int] = []
    state: DigitizationListState | None = None
    skip_state_validation_for: List[DigitizationState] = []


class AddDocumentsToListParams(BaseModel):
    skip_state_validation_for: List[DigitizationState] = []


# --------------------
# - Indexer Entities -
# --------------------
class DigitizationListHit(IndexerModel):
    state: DigitizationListState
    intentions: List[IntentionSummary]

    count_documents: int
    count_pages: int

    created_at: datetime
    created_by: str


class DigitizationList(DigitizationListHit, ModelValidateWithViewsMixin):
    class ESConfig:
        index = "digitization_lists"
        id_field = "id"

    id: int


# -------------
# - Task Data -
# -------------
class ChangeStateData(ChangeStateRequest):
    digitization_list_id: int


class AddDocumentsToListData(AddDocumentsToListParams):
    digitization_list_id: int


class RemoveDocumentsFromListData(BaseModel):
    digitization_list_id: int


class DeleteDigitizationListData(BaseModel):
    digitization_list_id: int


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
