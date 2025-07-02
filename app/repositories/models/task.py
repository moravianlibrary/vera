from typing import TYPE_CHECKING, List

from sqlalchemy import (
    JSON,
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
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, relationship

from adapters.database import BaseModel, DatabaseSession
from definitions.task import ScopedTaskType, TaskScope, TaskState
from repositories.models.mixins.created_audit import CreatedAuditMixin
from vera_scheduler import vera_scheduler

if TYPE_CHECKING:
    from repositories.models.addition import AdditionModel
    from repositories.models.catalog_record import CatalogRecordModel
    from repositories.models.category import CategoryModel
    from repositories.models.document import (
        DocumentIterationModel,
        DocumentModel,
    )


class TaskModel(BaseModel, CreatedAuditMixin):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True, unique=True)
    process_id = Column(Integer)

    task_type = Column(Enum(ScopedTaskType), nullable=False, index=True)
    name = Column(String, nullable=False)

    query = Column(JSON)
    data = Column(JSON)

    task_state = Column(
        Enum(TaskState), nullable=False, server_default=TaskState.Initializing
    )

    started = Column(TIMESTAMP)
    finished = Column(TIMESTAMP)

    result_message = Column(String)
    log = Column(LargeBinary)

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
    documents = relationship(
        "TaskDocument",
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
    categories = relationship(
        "TaskCategory",
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
            + self.documents
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
        "Addition", back_populates="tasks"
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
        "CatalogRecordModel", back_populates="tasks"
    )


class TaskDocumentModel(BaseModel, TaskItemMixin):
    __tablename__ = "task_documents"

    document_id = Column(Integer, ForeignKey("documents.id"), index=True)

    __table_args__ = (PrimaryKeyConstraint("task_id", "document_id"),)

    task: Mapped["TaskModel"] = relationship(
        "TaskModel", back_populates="documents"
    )
    document: Mapped["DocumentModel"] = relationship(
        "DocumentModel", back_populates="tasks"
    )


class TaskDocumentIterationModel(BaseModel, TaskItemMixin):
    __tablename__ = "task_document_iterations"

    document_iteration_id = Column(
        int, ForeignKey("document_iterations.id"), index=True
    )

    __table_args__ = (
        PrimaryKeyConstraint("task_id", "document_iteration_id"),
    )

    task: Mapped["TaskModel"] = relationship(
        "TaskModel", back_populates="documents"
    )
    document_iteration: Mapped["DocumentIterationModel"] = relationship(
        "DocumentIterationModel", back_populates="tasks"
    )


class TaskCategoryModel(BaseModel, TaskItemMixin):
    __tablename__ = "task_categories"

    category_id = Column(Integer, ForeignKey("categories.id"), index=True)

    __table_args__ = (PrimaryKeyConstraint("task_id", "category_id"),)

    task: Mapped["TaskModel"] = relationship(
        "TaskModel", back_populates="categories"
    )
    category: Mapped["CategoryModel"] = relationship(
        "CategoryModel", back_populates="tasks"
    )


class PeriodicTask(BaseModel):
    __tablename__ = "periodic_tasks"

    id = Column(Integer, primary_key=True, index=True, unique=True)

    task_type = Column(Enum(ScopedTaskType), nullable=False)
    query_params = Column(JSON)
    minute = Column(Integer, nullable=False)
    hour = Column(Integer)
    day_of_week = Column(Integer)
    day_of_month = Column(Integer)

    def schedule(self):
        from worker import run_periodic_task_instance

        def parse_cron_value(value: str | None) -> str:
            return value if value else "*"

        vera_scheduler.add_job(
            func=lambda: run_periodic_task_instance.delay(self.id),
            trigger="cron",
            id=str(self.id),
            replace_existing=True,
            minute=self.minute,
            hour=parse_cron_value(self.hour),
            day_of_week=parse_cron_value(self.day_of_week),
            day=parse_cron_value(self.day_of_month),
        )

    def save(self, session: DatabaseSession) -> "PeriodicTask":
        super().save(session)
        self.schedule()
        return self

    def validate_before_delete(self, session: DatabaseSession) -> None:
        vera_scheduler.remove_job(str(self.id))
