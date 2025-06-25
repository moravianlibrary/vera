from typing import List

from sqlalchemy import Boolean, Column, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, relationship

from adapters.database import BaseModel
from definitions.addition import AdditionStatus
from definitions.eligibility import EligibilityStatus
from definitions.identifier import IdentifierType

from .mixins.created_audit import CreatedAuditMixin


class AdditionBatchModel(BaseModel, CreatedAuditMixin):
    __tablename__ = "addition_batches"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String, nullable=True)
    file_name = Column(String, nullable=True)

    is_archived = Column(Boolean, default=False, nullable=False)

    additions: Mapped[List["AdditionModel"]] = relationship(
        "AdditionModel",
        backref="batch",
        lazy="selectin",
        cascade="all, delete-orphan",
    )


class AdditionModel(BaseModel):
    __tablename__ = "additions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(Integer, ForeignKey("addition_batches.id"))

    identifier_type = Column(Enum(IdentifierType), nullable=False)
    identifier_value = Column(String, nullable=False)
    category_id = Column(Integer, nullable=False)
    priority = Column(Integer, default=3, nullable=False)

    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    proposal_id = Column(Integer, ForeignKey("proposals.id"), nullable=True)

    allow_new_iteration = Column(Boolean, default=False, nullable=False)
    ignore_digitization_check = Column(Boolean, default=False, nullable=False)

    status = Column(
        Enum(AdditionStatus), default=AdditionStatus.Enqueued, nullable=False
    )
    eligibility_status = Column(Enum(EligibilityStatus), nullable=True)
    # TODO: maybe remove
    error_message = Column(String, nullable=True)

    batch: Mapped["AdditionBatchModel"] = relationship(
        "AdditionBatchModel", back_populates="additions", lazy="joined"
    )
    proposal = relationship("ProposalModel", backref="addition", lazy="joined")
