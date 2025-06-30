from typing import List

from pydantic import BaseModel, Field, model_validator

from adapters.indexer import (
    Boolean,
    Date,
    Enumerate,
    IndexerEntity,
    Integer,
    Keyword,
)
from definitions.addition import AdditionStatus
from definitions.document import Priority
from definitions.eligibility import EligibilityStatus
from definitions.identifier import IdentifierType
from schemas.task import Task


# --------------------
# - Query Parameters -
# --------------------
class AdditionBatchParams(BaseModel):
    batch_id: int | None = None
    batch_name: str | None = None
    file_name: str | None = None

    @model_validator(mode="after")
    def validate_either_id_or_name(
        cls, model: "AdditionBatchParams"
    ) -> "AdditionBatchParams":
        if model.batch_id and (model.batch_name or model.file_name):
            raise ValueError(
                "Either batch_id or batch_name/file_name must be provided,"
                " not both."
            )

        return model


class IngestAdditionsParams(BaseModel):
    allow_new_iteration: bool = False
    ignore_digitization_check: bool = False


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
class AdditionProject(IndexerEntity):
    id: Integer
    name: Keyword
    description: Keyword | None = None


class AdditionProposal(IndexerEntity):
    id: Integer

    batch_id: Integer
    batch_name: Keyword | None = None
    file_name: Keyword | None = None

    reason_message: Keyword | None = None


class Addition(IndexerEntity):
    id: Integer

    batch_id: Integer
    batch_name: Keyword | None = None
    file_name: Keyword | None = None
    created_by: Keyword
    created_at: Date
    is_archived: Boolean

    identifier_type: Enumerate[IdentifierType]
    identifier_value: Keyword
    category_id: Integer
    priority: Integer

    allow_new_iteration: Boolean
    ignore_digitization_check: Boolean

    status: Enumerate[AdditionStatus]
    eligibility_status: Enumerate[EligibilityStatus] | None

    project: AdditionProject | None = None
    proposal: AdditionProposal | None = None


# -------------
# - Task Data -
# -------------
class IngestBatchAdditionsTaskData(IngestAdditionsParams):
    batch_id: int
    additions: List[AdditionCreate]


class IngestProjectAdditionsTaskData(IngestBatchAdditionsTaskData):
    project_id: int


class ReingestAdditionsTaskData(IngestAdditionsParams):
    pass


# ----------------
# - Task Results -
# ----------------
