from datetime import datetime

from pydantic import BaseModel

from custom_types import (
    DocumentEligibilityStatus,
    DocumentProposalStatus,
    IdentifierType,
)


class DocumentProposalCreate(BaseModel):
    identifierType: IdentifierType
    identifierValue: str
    reasonMessage: str
    fileName: str | None
    categoryId: int | None


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
