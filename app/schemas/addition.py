from datetime import datetime
from typing import List

from esorm import ESBaseModel, ESModel
from pydantic import BaseModel, Field, model_validator

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
class AdditionProject(ESBaseModel):
    id: int
    name: str
    description: str | None


class AdditionProposal(ESBaseModel):
    id: int

    batch_id: int
    batch_name: str | None
    file_name: str | None

    reason_message: str | None


class Addition(ESModel):
    id: int

    batch_id: int
    batch_name: str | None
    file_name: str | None
    created_by: str
    created_at: datetime
    is_archived: bool

    identifier_type: IdentifierType
    identifier_value: str
    category_id: int
    priority: Priority

    allow_new_iteration: bool
    ignore_digitization_check: bool

    status: AdditionStatus
    eligibility_status: EligibilityStatus | None

    project: AdditionProject | None
    proposal: AdditionProposal | None


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
