from datetime import datetime

from sqlalchemy import Boolean, Column, Enum, Integer, String, Timestamp

from adapters.database import BaseModel
from custom_types import (
    DocumentEligibilityStatus,
    DocumentProposalStatus,
    IdentifierType,
)


class DocumentProposalModel(BaseModel):
    __tablename__ = "document_proposals"

    id = Column(Integer, primary_key=True, autoincrement=True)

    identifier_type = Column(Enum(IdentifierType), nullable=False)
    identifier_value = Column(String, nullable=False)

    reason_message = Column(String, nullable=True)
    file_name = Column(String, nullable=True)
    category_id = Column(Integer, nullable=True)

    created_by = Column(String, nullable=False)
    created_at = Column(Timestamp, default=datetime.utcnow, nullable=False)

    status = Column(
        Enum(DocumentProposalStatus),
        default=DocumentProposalStatus.Enqueued,
        nullable=False,
    )
    eligibility_status = Column(Enum(DocumentEligibilityStatus), nullable=True)

    is_archived = Column(Boolean, default=False, nullable=False)
