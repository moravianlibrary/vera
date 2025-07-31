from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, Column, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped

from adapters.database import BaseModel, belongs_to, contains, has_one
from definitions.addition import AdditionStatus
from definitions.eligibility import EligibilityStatus
from definitions.identifier import IdentifierType

from .mixins.created_audit import CreatedAuditMixin

if TYPE_CHECKING:
    from .project import ProjectModel
    from .proposal import ProposalModel


class AdditionBatchModel(BaseModel, CreatedAuditMixin):
    __tablename__ = "addition_batches"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String, nullable=True)
    file_name = Column(String, nullable=True)

    is_archived = Column(Boolean, default=False, nullable=False)

    additions: Mapped[List["AdditionModel"]] = contains(
        "AdditionModel", "batch"
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

    batch: Mapped["AdditionBatchModel"] = belongs_to(
        "AdditionBatchModel", "additions"
    )
    project: Mapped["ProjectModel"] = has_one("ProjectModel", "additions")
    proposal: Mapped["ProposalModel"] = has_one("ProposalModel", "addition")
