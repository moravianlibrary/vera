from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Column, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped

from adapters.database import BaseModel, belongs_to, contains, has_one
from definitions.eligibility import EligibilityStatus
from definitions.identifier import IdentifierType
from definitions.proposal import ProposalStatus

from .mixins.created_audit import CreatedAuditMixin
from .mixins.updated_audit import UpdatedAuditMixin

if TYPE_CHECKING:
    from .addition import AdditionModel
    from .project import ProjectModel
    from .task import TaskProposalModel


class ProposalBatchModel(BaseModel, CreatedAuditMixin):
    __tablename__ = "proposal_batches"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String, nullable=True)
    file_name = Column(String, nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)

    project: Mapped["ProjectModel"] = has_one(
        "ProjectModel", "proposal_batches"
    )
    proposals: Mapped[List["ProposalModel"]] = contains(
        "ProposalModel", "batch"
    )


class ProposalModel(BaseModel):
    __tablename__ = "proposals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(
        Integer, ForeignKey("proposal_batches.id"), nullable=False
    )

    identifier_type = Column(Enum(IdentifierType), nullable=False)
    identifier_value = Column(String, nullable=False)
    justification = Column(String, nullable=True)

    status = Column(
        Enum(ProposalStatus), default=ProposalStatus.Enqueued, nullable=False
    )
    eligibility_status = Column(Enum(EligibilityStatus), nullable=True)

    batch: Mapped["ProposalBatchModel"] = belongs_to(
        "ProposalBatchModel", "proposals"
    )

    addition: Mapped["AdditionModel"] = has_one("AdditionModel", "proposal")
    task_items: Mapped[List["TaskProposalModel"]] = contains(
        "TaskProposalModel", "proposal", "selectin"
    )

    status_log: Mapped[List["ProposalStatusLogModel"]] = contains(
        "ProposalStatusLogModel", "proposal", "dynamic"
    )

    @property
    def batch_name(self) -> str | None:
        return self.batch.name

    @property
    def file_name(self) -> str | None:
        return self.batch.file_name

    @property
    def project(self) -> Optional["ProjectModel"]:
        return self.batch.project

    @property
    def created_by(self) -> str:
        return self.batch.created_by

    @property
    def created_at(self) -> str:
        return self.batch.created_at


class ProposalStatusLogModel(BaseModel, UpdatedAuditMixin):
    __tablename__ = "proposal_status_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)

    proposal_id = Column(Integer, ForeignKey("proposals.id"), nullable=False)
    status = Column(Enum(ProposalStatus), nullable=False)
    message = Column(String, nullable=True)

    proposal: Mapped["ProposalModel"] = belongs_to(
        "ProposalModel", "status_log"
    )
