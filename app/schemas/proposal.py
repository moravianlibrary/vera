from dataclasses import Field
from datetime import datetime
from typing import List

from pydantic import BaseModel

from definitions.document import Priority
from definitions.eligibility import EligibilityStatus
from definitions.identifier import IdentifierType
from definitions.proposal import ProposalStatus
from schemas.addition import AdditionBatchParams, IngestAdditionsParams


class ProposalBatchParams(AdditionBatchParams):
    pass


class ProposalCreate(BaseModel):
    identifier_type: IdentifierType
    identifier_value: str
    reasonMessage: str


class IngestProposalsTaskData(BaseModel):
    batch_id: int
    proposals: List[ProposalCreate]
    project_id: int | None = None


class AcceptProposalsTaskData(IngestAdditionsParams):
    additions_batch_id: int
    category_id: int
    priority: Priority = Field(3, ge=1, le=5)


# TODO: reimplement with indexer model
class Proposal(ProposalCreate):
    id: int
    createdBy: str
    createdAt: datetime
    status: ProposalStatus
    eligibilityStatus: EligibilityStatus | None
    statusUpdatedBy: str | None
    statusUpdatedAt: datetime | None
    statusUpdateMessage: str | None
    isArchived: bool
    isArchived: bool
    isArchived: bool
