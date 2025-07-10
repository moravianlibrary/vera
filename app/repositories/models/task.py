from typing import TYPE_CHECKING, List

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    Column,
    Enum,
    ForeignKey,
    Integer,
    LargeBinary,
    PrimaryKeyConstraint,
    String,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, relationship

from adapters.database import BaseModel
from definitions.task import ScopedTaskType, TaskScope, TaskState
from repositories.models.mixins.created_audit import CreatedAuditMixin

if TYPE_CHECKING:
    from repositories.models.addition import AdditionModel
    from repositories.models.catalog_record import CatalogRecordModel
    from repositories.models.category import CategoryModel
    from repositories.models.digitization_list import DigitizationListModel
    from repositories.models.document import (
        DocumentIterationModel,
        DocumentModel,
    )
    from repositories.models.proposal import ProposalModel


class TaskModel(BaseModel, CreatedAuditMixin):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True, unique=True)
    process_id = Column(Integer)
    task_schedule_id = Column(
        Integer, ForeignKey("task_schedules.id"), nullable=True
    )

    task_type = Column(Enum(ScopedTaskType), nullable=False, index=True)
    name = Column(String, nullable=False)

    query = Column(JSONB)
    data = Column(JSONB)

    task_state = Column(
        Enum(TaskState), nullable=False, server_default=TaskState.Initializing
    )

    started_at = Column(TIMESTAMP)
    finished_at = Column(TIMESTAMP)

    result = Column(JSONB, nullable=True)
    log = Column(LargeBinary)

    task_schedule: Mapped["TaskScheduleModel"] = relationship(
        "TaskScheduleModel", back_populates="tasks", lazy="joined"
    )

    additions: Mapped[List["TaskAdditionModel"]] = relationship(
        "TaskAdditionModel",
        back_populates="task",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    catalog_records = relationship(
        "TaskCatalogRecord",
        back_populates="task",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    categories = relationship(
        "TaskCategory",
        back_populates="task",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    digitization_lists = relationship(
        "TaskDigitizationList",
        back_populates="task",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    documents_iterations = relationship(
        "TaskDocumentIteration",
        back_populates="task",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    proposals = relationship(
        "TaskProposalModel",
        back_populates="task",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    @hybrid_property
    def scope(self) -> TaskScope:
        return TaskScope(self.task_type.split(".")[0])

    @hybrid_property
    def unscoped_task_type(self) -> str:
        return self.task_type.split(".")[1]

    @hybrid_property
    def items(self) -> List["TaskItemMixin"]:
        return (
            self.additions
            + self.catalog_records
            + self.documents_iterations
            + self.categories
        )

    @hybrid_property
    def processed_count(self) -> int:
        return sum(1 for item in self.items if item.processed)

    @hybrid_property
    def total_count(self) -> int:
        return len(self.items)

    @hybrid_property
    def error_count(self) -> int:
        return sum(1 for item in self.items if item.error_message)


class TaskItemMixin:
    @declared_attr
    def task_id(cls):
        return Column(Integer, ForeignKey("tasks.id"), index=True)

    @declared_attr
    def processed(cls):
        return Column(Boolean, server_default="false")

    @declared_attr
    def error_message(cls):
        return Column(String, nullable=True)


class TaskAdditionModel(BaseModel, TaskItemMixin):
    __tablename__ = "task_additions"

    addition_id = Column(Integer, ForeignKey("additions.id"), index=True)

    __table_args__ = (PrimaryKeyConstraint("task_id", "addition_id"),)

    task: Mapped["TaskModel"] = relationship(
        "TaskModel", back_populates="additions"
    )
    addition: Mapped["AdditionModel"] = relationship(
        "Addition", back_populates="task_items"
    )


class TaskCatalogRecordModel(BaseModel, TaskItemMixin):
    __tablename__ = "task_catalog_records"

    catalog_record_id = Column(
        String, ForeignKey("catalog_records.id"), index=True
    )

    __table_args__ = (PrimaryKeyConstraint("task_id", "catalog_record_id"),)

    task: Mapped["TaskModel"] = relationship(
        "TaskModel", back_populates="catalog_records"
    )
    catalog_record: Mapped["CatalogRecordModel"] = relationship(
        "CatalogRecordModel", back_populates="task_items"
    )


class TaskCategoryModel(BaseModel, TaskItemMixin):
    __tablename__ = "task_categories"

    category_id = Column(Integer, ForeignKey("categories.id"), index=True)

    __table_args__ = (PrimaryKeyConstraint("task_id", "category_id"),)

    task: Mapped["TaskModel"] = relationship(
        "TaskModel", back_populates="categories"
    )
    category: Mapped["CategoryModel"] = relationship(
        "CategoryModel", back_populates="task_items"
    )


class TaskDigitizationList(BaseModel, TaskItemMixin):
    __tablename__ = "task_digitization_lists"

    digitization_list_id = Column(
        Integer, ForeignKey("digitization_lists.id"), index=True
    )

    __table_args__ = (PrimaryKeyConstraint("task_id", "digitization_list_id"),)

    task: Mapped["TaskModel"] = relationship(
        "TaskModel", back_populates="digitization_lists"
    )
    digitization_list: Mapped["DigitizationListModel"] = relationship(
        "DigitizationListModel", back_populates="task_items"
    )


class TaskDocumentIterationModel(BaseModel, TaskItemMixin):
    __tablename__ = "task_document_iterations"

    document_iteration_id = Column(
        int, ForeignKey("document_iterations.id"), index=True
    )
    document_id = Column(Integer, ForeignKey("documents.id"), index=True)

    __table_args__ = (
        PrimaryKeyConstraint("task_id", "document_iteration_id"),
    )

    task: Mapped["TaskModel"] = relationship(
        "TaskModel", back_populates="documents"
    )
    document_iteration: Mapped["DocumentIterationModel"] = relationship(
        "DocumentIterationModel", back_populates="task_items"
    )
    document: Mapped["DocumentModel"] = relationship(
        "DocumentModel", back_populates="task_items"
    )


class TaskProposalModel(BaseModel, TaskItemMixin):
    __tablename__ = "task_proposals"

    proposal_id = Column(Integer, ForeignKey("proposals.id"), index=True)

    __table_args__ = (PrimaryKeyConstraint("task_id", "proposal_id"),)

    task: Mapped["TaskModel"] = relationship(
        "TaskModel", back_populates="proposals"
    )
    proposal: Mapped["ProposalModel"] = relationship(
        "ProposalModel", back_populates="task_items"
    )


class TaskScheduleModel(BaseModel):
    __tablename__ = "task_schedules"

    id = Column(Integer, primary_key=True, index=True, unique=True)
    name = Column(String, nullable=False)

    task_type = Column(Enum(ScopedTaskType), nullable=False)
    query = Column(JSONB)
    cron_expression = Column(String, nullable=False)

    tasks: Mapped[List["TaskModel"]] = relationship(
        "TaskModel",
        back_populates="task_schedule",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    @hybrid_property
    def scope(self) -> TaskScope:
        return TaskScope(self.task_type.split(".")[0])

    @hybrid_property
    def unscoped_task_type(self) -> str:
        return self.task_type.split(".")[1]
