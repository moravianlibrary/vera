from datetime import datetime
from typing import List

from pydantic import BaseModel, Field

from adapters.indexer import IndexerModel, IndexerNestedModel
from definitions.document import Priority
from definitions.eligibility import EligibilityStatus
from definitions.identifier import IdentifierType
from definitions.proposal import ProposalStatus
from schemas.addition import AdditionsBatchParams, AdditionsSettingsParams
from schemas.project import ProjectSummary
from schemas.task import Task


# --------------------
# - Query Parameters -
# --------------------
class ProposalsBatchParams(AdditionsBatchParams):
    pass


class ProposalsSettingsParams(AdditionsSettingsParams):
    category_id: int
    priority: Priority = Field(3, ge=1, le=5)


class ApproveProposalsParams(ProposalsBatchParams, ProposalsSettingsParams):
    @property
    def batch(self) -> ProposalsBatchParams:
        return ProposalsBatchParams(
            batch_id=self.batch_id,
            batch_name=self.batch_name,
            file_name=self.file_name,
            project_id=self.project_id,
        )

    @property
    def settings(self) -> ProposalsSettingsParams:
        return ProposalsSettingsParams(
            allow_new_iteration=self.allow_new_iteration,
            ignore_digitization_check=self.ignore_digitization_check,
            category_id=self.category_id,
            priority=self.priority,
        )


class RejectProposalsParams(BaseModel):
    message: str | None = None


# --------------------
# - Request Payloads -
# --------------------
class ProposalCreate(BaseModel):
    identifier_type: IdentifierType
    identifier_value: str
    justification: str | None = None


# -----------------
# - API Responses -
# -----------------
class IngestProposalsResponse(BaseModel):
    task: Task
    batch_id: int


# --------------------
# - Indexer Entities -
# --------------------
class ProposalStatusLog(IndexerNestedModel):
    status: ProposalStatus
    message: str | None = None
    updated_by: str
    updated_at: datetime


class ProposalHit(IndexerModel):
    batch_id: int
    batch_name: str | None = None
    file_name: str | None = None
    created_by: str
    created_at: datetime

    identifier_type: IdentifierType
    identifier_value: str
    justification: str | None = None

    project: ProjectSummary | None = None

    status: ProposalStatus
    eligibility_status: EligibilityStatus | None = None

    status_log: List[ProposalStatusLog]


class Proposal(ProposalHit):
    class ESConfig:
        index = "proposals"

    id: int


# -------------
# - Task Data -
# -------------
class IngestProposalsTaskData(BaseModel):
    batch_id: int
    proposals: List[ProposalCreate]


class ApproveProposalsTaskData(BaseModel):
    batch_id: int
    settings: ProposalsSettingsParams
