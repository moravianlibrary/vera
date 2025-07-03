from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, Column, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, relationship

from adapters.database import BaseModel
from definitions.eligibility import EligibilityStatus
from definitions.identifier import IdentifierType
from definitions.proposal import ProposalStatus

from .mixins.created_audit import CreatedAuditMixin
from .mixins.updated_audit import UpdatedAuditMixin

if TYPE_CHECKING:
    from .addition import AdditionModel
    from .category import CategoryModel
    from .project import ProjectModel


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
    batch_id = Column(
        Integer, ForeignKey("proposal_batches.id"), nullable=False
    )

    identifier_type = Column(Enum(IdentifierType), nullable=False)
    identifier_value = Column(String, nullable=False)

    reason_message = Column(String, nullable=True)
    category_id = Column(Integer, ForeignKey("category.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)

    status = Column(
        Enum(ProposalStatus), default=ProposalStatus.Enqueued, nullable=False
    )
    eligibility_status = Column(Enum(EligibilityStatus), nullable=True)

    batch: Mapped["ProposalBatchModel"] = relationship(
        "ProposalBatchModel", back_populates="proposals", lazy="joined"
    )
    category: Mapped["CategoryModel"] = relationship(
        "CategoryModel", back_populates="proposals", lazy="joined"
    )
    project: Mapped["ProjectModel"] = relationship(
        "ProjectModel", back_populates="proposals", lazy="joined"
    )

    addition: Mapped["AdditionModel"] = relationship(
        "AdditionModel", backref="proposal"
    )

    status_log: Mapped[List["ProposalStatusLogModel"]] = relationship(
        "ProposalStatusLogModel",
        backref="proposal",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )


class ProposalStatusLogModel(BaseModel, UpdatedAuditMixin):
    __tablename__ = "proposal_status_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)

    proposal_id = Column(Integer, ForeignKey("proposals.id"), nullable=False)
    status = Column(Enum(ProposalStatus), nullable=False)

    proposal: Mapped["ProposalModel"] = relationship(
        "ProposalModel", backref="status_log"
    )
