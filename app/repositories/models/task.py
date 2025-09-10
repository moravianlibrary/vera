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
from sqlalchemy.orm import Mapped

from adapters.database import BaseModel, belongs_to, contains, has_one
from definitions.task import (
    SCOPE_TO_TYPE,
    ScopedTaskType,
    TaskScope,
    TaskState,
    TaskType,
)

from .mixins.created_audit import CreatedAuditMixin
from .mixins.notification import NotificationMixin

if TYPE_CHECKING:
    from .addition import AdditionModel
    from .catalog_record import CatalogRecordModel
    from .category import CategoryModel
    from .digitization_list import DigitizationListModel
    from .document import DocumentIterationModel, DocumentModel
    from .proposal import ProposalModel
    from .user import UserModel


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

    task_schedule: Mapped["TaskScheduleModel"] = has_one(
        "TaskScheduleModel", "tasks"
    )
    notifications: Mapped[List["TaskNotificationModel"]] = contains(
        "TaskNotificationModel", "task", "selectin"
    )

    additions: Mapped[List["TaskAdditionModel"]] = contains(
        "TaskAdditionModel", "task", "selectin"
    )
    catalog_records: Mapped[List["TaskCatalogRecordModel"]] = contains(
        "TaskCatalogRecordModel", "task", "selectin"
    )
    categories: Mapped[List["TaskCategoryModel"]] = contains(
        "TaskCategoryModel", "task", "selectin"
    )
    digitization_lists: Mapped[List["TaskDigitizationListModel"]] = contains(
        "TaskDigitizationListModel", "task", "selectin"
    )
    document_iterations: Mapped[List["TaskDocumentIterationModel"]] = contains(
        "TaskDocumentIterationModel", "task", "selectin"
    )
    proposals: Mapped[List["TaskProposalModel"]] = contains(
        "TaskProposalModel", "task", "selectin"
    )

    @hybrid_property
    def task_scope(self) -> TaskScope:
        return TaskScope(self.task_type.split(".")[0])

    @hybrid_property
    def unscoped_task_type(self) -> TaskType:
        return SCOPE_TO_TYPE[self.task_scope][self.task_type.split(".")[1]]

    @hybrid_property
    def has_query(self) -> bool:
        return self.query is not None

    @hybrid_property
    def has_data(self) -> bool:
        return self.data is not None

    @hybrid_property
    def items(self) -> List["TaskItemMixin"]:
        return (
            self.additions
            + self.catalog_records
            + self.document_iterations
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

    task: Mapped["TaskModel"] = belongs_to("TaskModel", "additions")
    addition: Mapped["AdditionModel"] = belongs_to(
        "AdditionModel", "task_items"
    )


class TaskCatalogRecordModel(BaseModel, TaskItemMixin):
    __tablename__ = "task_catalog_records"

    catalog_record_id = Column(
        String, ForeignKey("catalog_records.id"), index=True
    )

    __table_args__ = (PrimaryKeyConstraint("task_id", "catalog_record_id"),)

    task: Mapped["TaskModel"] = belongs_to("TaskModel", "catalog_records")
    catalog_record: Mapped["CatalogRecordModel"] = belongs_to(
        "CatalogRecordModel", "task_items"
    )


class TaskCategoryModel(BaseModel, TaskItemMixin):
    __tablename__ = "task_categories"

    category_id = Column(Integer, ForeignKey("categories.id"), index=True)

    __table_args__ = (PrimaryKeyConstraint("task_id", "category_id"),)

    task: Mapped["TaskModel"] = belongs_to("TaskModel", "categories")
    category: Mapped["CategoryModel"] = belongs_to(
        "CategoryModel", "task_items"
    )


class TaskDigitizationListModel(BaseModel, TaskItemMixin):
    __tablename__ = "task_digitization_lists"

    digitization_list_id = Column(
        Integer, ForeignKey("digitization_lists.id"), index=True
    )

    __table_args__ = (PrimaryKeyConstraint("task_id", "digitization_list_id"),)

    task: Mapped["TaskModel"] = belongs_to("TaskModel", "digitization_lists")
    digitization_list: Mapped["DigitizationListModel"] = belongs_to(
        "DigitizationListModel", "task_items"
    )


class TaskDocumentIterationModel(BaseModel, TaskItemMixin):
    __tablename__ = "task_document_iterations"

    document_iteration_id = Column(
        Integer, ForeignKey("document_iterations.id"), index=True
    )
    document_id = Column(Integer, ForeignKey("documents.id"), index=True)

    __table_args__ = (
        PrimaryKeyConstraint("task_id", "document_iteration_id"),
    )

    task: Mapped["TaskModel"] = belongs_to("TaskModel", "document_iterations")
    document_iteration: Mapped["DocumentIterationModel"] = belongs_to(
        "DocumentIterationModel", "task_items"
    )
    document: Mapped["DocumentModel"] = belongs_to(
        "DocumentModel", "task_items"
    )


class TaskProposalModel(BaseModel, TaskItemMixin):
    __tablename__ = "task_proposals"

    proposal_id = Column(Integer, ForeignKey("proposals.id"), index=True)

    __table_args__ = (PrimaryKeyConstraint("task_id", "proposal_id"),)

    task: Mapped["TaskModel"] = belongs_to("TaskModel", "proposals")
    proposal: Mapped["ProposalModel"] = belongs_to(
        "ProposalModel", "task_items"
    )


class TaskScheduleModel(BaseModel, CreatedAuditMixin):
    __tablename__ = "task_schedules"

    id = Column(Integer, primary_key=True, index=True, unique=True)

    task_type = Column(Enum(ScopedTaskType), nullable=False)

    name = Column(String, nullable=False)
    cron_expression = Column(String, nullable=False)

    query = Column(JSONB)
    data = Column(JSONB)

    tasks: Mapped[List["TaskModel"]] = contains(
        "TaskModel", "task_schedule", "selectin"
    )

    @hybrid_property
    def task_scope(self) -> TaskScope:
        return TaskScope(self.task_type.split(".")[0])

    @hybrid_property
    def unscoped_task_type(self) -> str:
        return self.task_type.split(".")[1]


TaskOrScheduleModel = TaskModel | TaskScheduleModel


class TaskNotificationModel(BaseModel, NotificationMixin):
    __tablename__ = "task_notifications"

    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    previous_state = Column(Enum(TaskState), nullable=False)
    new_state = Column(Enum(TaskState), nullable=False)

    task: Mapped["TaskModel"] = belongs_to("TaskModel", "notifications")
    user: Mapped["UserModel"] = belongs_to("UserModel", "task_notifications")
