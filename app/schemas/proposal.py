from datetime import datetime
from typing import List

from esorm import ESBaseModel, ESModel
from pydantic import BaseModel, Field

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
class ProposalStatusLog(ESBaseModel):
    status: ProposalStatus
    message: str | None = None
    updated_by: str
    updated_at: datetime


class Proposal(ESModel):
    class ESConfig:
        index = "proposals"

    id: int

    batch_id: int
    batch_name: str | None
    file_name: str | None
    created_by: str
    created_at: datetime
    is_archived: bool

    identifier_type: IdentifierType
    identifier_value: str

    reason_message: str | None

    category: CategorySummary | None

    project: ProjectSummary | None

    status: ProposalStatus
    eligibility_status: EligibilityStatus | None

    status_log: List[ProposalStatusLog]


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
