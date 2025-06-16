from sqlalchemy import Boolean, Column, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from adapters.database import BaseModel
from definitions.addition import AdditionStatus
from definitions.eligibility import EligibilityStatus
from definitions.identifier import IdentifierType

from .mixins.created_audit import CreatedAuditMixin


class AdditionModel(BaseModel, CreatedAuditMixin):
    __tablename__ = "document_additions"

    id = Column(Integer, primary_key=True, autoincrement=True)

    identifier_type = Column(Enum(IdentifierType), nullable=False)
    identifier_value = Column(String, nullable=False)
    batch_name = Column(String, nullable=False)
    category_id = Column(Integer, nullable=False)
    priority = Column(Integer, default=3, nullable=False)

    proposal_id = Column(
        Integer, ForeignKey("document_proposals.id"), nullable=True
    )

    ignore_digitization_check = Column(Boolean, default=False, nullable=False)
    allow_new_iteration = Column(Boolean, default=False, nullable=False)

    status = Column(
        Enum(AdditionStatus), default=AdditionStatus.Enqueued, nullable=False
    )
    eligibility_status = Column(Enum(EligibilityStatus), nullable=True)
    error_message = Column(String, nullable=True)

    is_archived = Column(Boolean, default=False, nullable=False)

    proposal = relationship(
        "DocumentProposalModel",
        backref="addition",
        lazy="joined",
    )
