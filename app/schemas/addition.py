from typing import Any

from pydantic import BaseModel, Field
from pymarc import Dict

from adapters.indexer import (
    Boolean,
    Date,
    Enumerate,
    IndexerEntity,
    Integer,
    Keyword,
)
from definitions.addition import AdditionStatus
from definitions.eligibility import EligibilityStatus
from definitions.identifier import IdentifierType


class AdditionCreate(BaseModel):
    identifier_type: IdentifierType
    identifier_value: str
    batch_name: str
    category_id: int
    priority: int = Field(3, ge=1, le=5)


class EnqueueAdditionResponse(BaseModel):
    enqueued: int


class UpdateAdditionResponse(BaseModel):
    updated: int


class ArchiveAdditionResponse(BaseModel):
    archived: int


class DeleteAdditionResponse(BaseModel):
    deleted: int
    ignored: int


class Addition(AdditionCreate, IndexerEntity):
    id: Integer

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
