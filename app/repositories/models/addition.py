from typing import TYPE_CHECKING, List, Optional

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
    from .task import TaskAdditionModel
    from .watchlist import WatchlistAdditionModel


class AdditionBatchModel(BaseModel, CreatedAuditMixin):
    __tablename__ = "addition_batches"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String, nullable=True)
    file_name = Column(String, nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)

    project: Mapped["ProjectModel"] = has_one(
        "ProjectModel", "addition_batches"
    )
    additions: Mapped[List["AdditionModel"]] = contains(
        "AdditionModel", "batch"
    )


class AdditionModel(BaseModel):
    __tablename__ = "additions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(
        Integer, ForeignKey("addition_batches.id"), nullable=False
    )

    identifier_type = Column(Enum(IdentifierType), nullable=False)
    identifier_value = Column(String, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    priority = Column(Integer, default=3, nullable=False)

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
    proposal: Mapped["ProposalModel"] = has_one("ProposalModel", "addition")

    task_items: Mapped[List["TaskAdditionModel"]] = contains(
        "TaskAdditionModel", "addition"
    )
    watchlists: Mapped[List["WatchlistAdditionModel"]] = contains(
        "WatchlistAdditionModel", "addition"
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
