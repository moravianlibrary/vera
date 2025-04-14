from sqlalchemy import Boolean, Column, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from adapters.database import BaseModel
from custom_types import (
    DocumentEligibilityStatus,
    DocumentProposalStatus,
    IdentifierType,
)

from .mixins import CreatedAuditMixin, UpdatedAuditLogMixin


class DocumentProposalModel(BaseModel, CreatedAuditMixin):
    __tablename__ = "document_proposals"

    id = Column(Integer, primary_key=True, autoincrement=True)

    identifier_type = Column(Enum(IdentifierType), nullable=False)
    identifier_value = Column(String, nullable=False)

    reason_message = Column(String, nullable=True)
    file_name = Column(String, nullable=True)
    category_id = Column(Integer, nullable=True)

    status = Column(
        Enum(DocumentProposalStatus),
        default=DocumentProposalStatus.Enqueued,
        nullable=False,
    )
    eligibility_status = Column(Enum(DocumentEligibilityStatus), nullable=True)

    is_archived = Column(Boolean, default=False, nullable=False)

    status_logs = relationship(
        "DocumentProposalStatusLogModel",
        backref="proposal",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    addition = relationship("DocumentAdditionModel", backref="proposal")


class DocumentProposalStatusLogModel(BaseModel, UpdatedAuditLogMixin):
    __tablename__ = "document_proposal_status_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)

    proposal_id = Column(
        Integer, ForeignKey("document_proposals.id"), nullable=False
    )
    status = Column(Enum(DocumentProposalStatus), nullable=False)

    proposal = relationship("DocumentProposalModel", backref="status_logs")
