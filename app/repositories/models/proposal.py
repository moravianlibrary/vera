from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, Column, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped

from adapters.database import BaseModel, belongs_to, contains, has_one
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

    proposals: Mapped[List["ProposalModel"]] = contains(
        "ProposalModel", "batch", "selectin"
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
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)

    status = Column(
        Enum(ProposalStatus), default=ProposalStatus.Enqueued, nullable=False
    )
    eligibility_status = Column(Enum(EligibilityStatus), nullable=True)

    batch: Mapped["ProposalBatchModel"] = belongs_to(
        "ProposalBatchModel", "proposals"
    )
    category: Mapped["CategoryModel"] = has_one("CategoryModel", "proposals")
    project: Mapped["ProjectModel"] = has_one("ProjectModel", "proposals")

    addition: Mapped["AdditionModel"] = has_one("AdditionModel", "proposal")

    status_log: Mapped[List["ProposalStatusLogModel"]] = contains(
        "ProposalStatusLogModel", "proposal", "dynamic"
    )


class ProposalStatusLogModel(BaseModel, UpdatedAuditMixin):
    __tablename__ = "proposal_status_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)

    proposal_id = Column(Integer, ForeignKey("proposals.id"), nullable=False)
    status = Column(Enum(ProposalStatus), nullable=False)

    proposal: Mapped["ProposalModel"] = belongs_to(
        "ProposalModel", "status_log"
    )
