from datetime import datetime

from pydantic import BaseModel

from custom_types import (
    DocumentEligibilityStatus,
    DocumentProposalStatus,
    IdentifierType,
)


class DocumentProposalCreate(BaseModel):
    catalog_record_id: str
    issue_id: str
    reasonMessage: str


class DocumentProposalCreate2(BaseModel):
    identifierType: IdentifierType
    identifierValue: str
    reasonMessage: str
    fileName: str | None


class DocumentProposal(DocumentProposalCreate):
    id: int
    createdBy: str
    createdAt: datetime
    status: DocumentProposalStatus
    eligibilityStatus: DocumentEligibilityStatus | None
    statusUpdatedBy: str | None
    statusUpdatedAt: datetime | None
    statusUpdateMessage: str | None
    isArchived: bool
