from datetime import datetime
from typing import List

from esorm.fields import keyword, long, text
from pydantic import BaseModel, Field

from adapters.indexer import IndexerModel, IndexerNestedModel
from definitions.addition import AdditionStatus
from definitions.document import Priority
from definitions.eligibility import EligibilityStatus
from definitions.identifier import IdentifierType
from schemas.task import Task
from schemas.watchlist import WatchlistSummary


# --------------------
# - Query Parameters -
# --------------------
class AdditionsBatchParams(BaseModel):
    batch_id: int | None = None
    batch_name: str | None = None
    file_name: str | None = None
    project_id: int | None = None


class AdditionsSettingsParams(BaseModel):
    allow_new_iteration: bool = False
    ignore_digitization_check: bool = False


class IngestAdditionsParams(AdditionsBatchParams, AdditionsSettingsParams):
    @property
    def batch(self) -> AdditionsBatchParams:
        return AdditionsBatchParams(
            batch_id=self.batch_id,
            batch_name=self.batch_name,
            file_name=self.file_name,
            project_id=self.project_id,
        )

    @property
    def settings(self) -> AdditionsSettingsParams:
        return AdditionsSettingsParams(
            allow_new_iteration=self.allow_new_iteration,
            ignore_digitization_check=self.ignore_digitization_check,
        )


# --------------------
# - Request Payloads -
# --------------------
class AdditionCreate(BaseModel):
    identifier_type: IdentifierType
    identifier_value: str
    category_id: int
    priority: Priority = Field(3, ge=1, le=5)


# -----------------
# - API Responses -
# -----------------
class IngestAdditionsResponse(BaseModel):
    task: Task
    batch_id: int


# --------------------
# - Indexer Entities -
# --------------------
class AdditionProject(IndexerNestedModel):
    id: long
    name: keyword
    description: text | None = None


class AdditionProposal(IndexerNestedModel):
    id: long

    batch_id: long
    batch_name: text | None = None
    file_name: text | None = None

    justification: text | None = None


class Addition(IndexerModel):
    class ESConfig:
        index = "additions"
        id_field = "id"

    id: long

    batch_id: long
    batch_name: text | None = None
    file_name: text | None = None
    created_by: keyword
    created_at: datetime

    identifier_type: IdentifierType
    identifier_value: keyword
    category_id: long
    priority: Priority

    allow_new_iteration: bool
    ignore_digitization_check: bool

    status: AdditionStatus
    eligibility_status: EligibilityStatus | None = None

    project: AdditionProject | None = None
    proposal: AdditionProposal | None = None

    watchlists: List[WatchlistSummary] = []


# -------------
# - Task Data -
# -------------
class IngestBatchAdditionsTaskData(AdditionsSettingsParams):
    batch_id: int
    additions: List[AdditionCreate]


class IngestProjectAdditionsTaskData(IngestBatchAdditionsTaskData):
    project_id: int


class ReingestAdditionsTaskData(AdditionsSettingsParams):
    pass


# ----------------
# - Task Results -
# ----------------
