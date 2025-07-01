from typing import List

from pydantic import BaseModel, Field

from adapters.indexer import (
    Boolean,
    Date,
    Enumerate,
    IndexerEntity,
    Integer,
    Keyword,
)
from definitions.document import Priority
from definitions.eligibility import EligibilityStatus
from definitions.identifier import IdentifierType
from definitions.proposal import ProposalStatus
from schemas.addition import AdditionBatchParams, IngestAdditionsParams
from schemas.category import CategorySummary
from schemas.project import ProjectSummary


# --------------------
# - Query Parameters -
# --------------------
class ProposalBatchParams(AdditionBatchParams):
    pass


# --------------------
# - Request Payloads -
# --------------------
class ProposalCreate(BaseModel):
    identifier_type: IdentifierType
    identifier_value: str
    reasonMessage: str


# --------------------
# - Indexer Entities -
# --------------------
class ProposalStatusLog(IndexerEntity):
    status: Enumerate[ProposalStatus]
    updated_at: Date
    updated_by: Keyword


class Proposal(IndexerEntity):
    id: Integer

    batch_id: Integer
    batch_name: Keyword | None = None
    file_name: Keyword | None = None
    created_by: Keyword
    created_at: Date
    is_archived: Boolean

    identifier_type: Enumerate[IdentifierType]
    identifier_value: Keyword

    reason_message: Keyword | None

    category: CategorySummary | None

    project: ProjectSummary | None

    status: Enumerate[ProposalStatus]
    eligibility_status: Enumerate[EligibilityStatus] | None

    status_logs: List[ProposalStatusLog]


# -------------
# - Task Data -
# -------------
class IngestProposalsTaskData(BaseModel):
    batch_id: int
    proposals: List[ProposalCreate]
    project_id: int | None = None


class AcceptProposalsTaskData(IngestAdditionsParams):
    additions_batch_id: int
    category_id: int
    priority: Priority = Field(3, ge=1, le=5)
