from sqlalchemy import Boolean, Column, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from adapters.database import BaseModel
from custom_types import DocumentAdditionStatus, IdentifierType
from custom_types.document_eligibility import DocumentEligibilityStatus

from .mixins.created_audit import CreatedAuditMixin


class DocumentAdditionModel(BaseModel, CreatedAuditMixin):
    __tablename__ = "document_additions"

    id = Column(Integer, primary_key=True, autoincrement=True)

    identifier_type = Column(Enum(IdentifierType), nullable=False)
    identifier_value = Column(String, nullable=False)

    file_name = Column(String, nullable=True)
    proposal_id = Column(
        Integer, ForeignKey("document_proposals.id"), nullable=True
    )
    category_id = Column(Integer, nullable=False)
    priority = Column(Integer, default=3, nullable=False)

    ignore_digitization_check = Column(Boolean, default=False, nullable=False)
    allow_new_iteration = Column(Boolean, default=False, nullable=False)

    status = Column(
        Enum(DocumentAdditionStatus),
        default=DocumentAdditionStatus.Enqueued,
        nullable=False,
    )
    eligibility_status = Column(Enum(DocumentEligibilityStatus), nullable=True)
    error_message = Column(String, nullable=True)

    is_archived = Column(Boolean, default=False, nullable=False)

    proposal = relationship(
        "DocumentProposalModel",
        backref="addition",
        lazy="joined",
    )
