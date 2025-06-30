from typing import List

from sqlalchemy import Boolean, Column, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, relationship

from adapters.database import BaseModel
from definitions.eligibility import EligibilityStatus
from definitions.identifier import IdentifierType
from definitions.proposal import ProposalStatus

from .mixins.created_audit import CreatedAuditMixin
from .mixins.updated_audit import UpdatedAuditMixin


class ProposalBatchModel(BaseModel, CreatedAuditMixin):
    __tablename__ = "proposal_batches"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String, nullable=True)
    file_name = Column(String, nullable=True)

    is_archived = Column(Boolean, default=False, nullable=False)

    proposals: Mapped[List["ProposalModel"]] = relationship(
        "ProposalModel",
        backref="batch",
        lazy="selectin",
        cascade="all, delete-orphan",
    )


class ProposalModel(BaseModel):
    __tablename__ = "proposals"

    id = Column(Integer, primary_key=True, autoincrement=True)

    identifier_type = Column(Enum(IdentifierType), nullable=False)
    identifier_value = Column(String, nullable=False)

    reason_message = Column(String, nullable=True)
    category_id = Column(Integer, nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)

    status = Column(
        Enum(ProposalStatus), default=ProposalStatus.Enqueued, nullable=False
    )
    eligibility_status = Column(Enum(EligibilityStatus), nullable=True)

    status_logs = relationship(
        "ProposalStatusLogModel",
        backref="proposal",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    addition = relationship("AdditionModel", backref="proposal")


class ProposalStatusLogModel(BaseModel, UpdatedAuditMixin):
    __tablename__ = "document_proposal_status_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)

    proposal_id = Column(
        Integer, ForeignKey("document_proposals.id"), nullable=False
    )
    status = Column(Enum(ProposalStatus), nullable=False)

    proposal = relationship("ProposalModel", backref="status_logs")
