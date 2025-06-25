from typing import Any, Dict, List

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


class AdditionCreate(BaseModel):
    identifier_type: IdentifierType
    identifier_value: str
    category_id: int
    priority: Priority = Field(3, ge=1, le=5)


class IngestAdditionsResponse(BaseModel):
    task: Task
    batch_id: int


class IngestBatchAdditionsTaskData(IngestAdditionsParams):
    batch_id: int
    additions: List[AdditionCreate]


class IngestProjectAdditionsTaskData(IngestBatchAdditionsTaskData):
    project_id: int


class ReingestAdditionsTaskData(IngestAdditionsParams):
    pass


class EnqueueAdditionResponse(BaseModel):
    enqueued: int


class UpdateAdditionResponse(BaseModel):
    updated: int


class ArchiveAdditionResponse(BaseModel):
    archived: int


class DeleteAdditionResponse(BaseModel):
    deleted: int
    ignored: int


class Addition(IndexerEntity):
    id: Integer

    batch_name: str
    porposal_id: Integer | None = None

    ignore_digitization_check: Boolean
    allow_new_iteration: Boolean

    created_by: Keyword
    created_at: Date

    status: Enumerate[AdditionStatus]
    eligibility_status: Enumerate[EligibilityStatus] | None
    error_message: Keyword | None

    is_archived: Boolean

    proposal: Dict[str, Any] | None = None
