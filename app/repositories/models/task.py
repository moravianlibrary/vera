from typing import List, Optional, Tuple

from sqlalchemy import (
    JSON,
    TIMESTAMP,
    Boolean,
    Column,
    Enum,
    ForeignKey,
    Integer,
    PrimaryKeyConstraint,
    String,
    func,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Query, Session, relationship

from vera_scheduler import vera_scheduler

from ..._old.models.base import BaseModel


class Task(BaseModel):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True, unique=True)
    process_id = Column(Integer)

    task_type = Column(Enum(TaskType), nullable=False, index=True)
    owner = Column(String, nullable=False, index=True)

    query = Column(JSON)

    task_state = Column(
        Enum(TaskState), nullable=False, server_default=TaskState.Planned.value
    )

    planned = Column(TIMESTAMP, server_default=func.now())
    started = Column(TIMESTAMP)
    finished = Column(TIMESTAMP)

    items = relationship("TaskItem", back_populates="task")
    dataset = relationship("TaskDataset", back_populates="task", uselist=False)

    @hybrid_property
    def processed_count(self):
        return sum(1 for item in self.items if item.processed)

    @hybrid_property
    def total_count(self):
        return len(self.items)

    @hybrid_property
    def error_count(self):
        return sum(1 for item in self.items if item.error_type)

    @hybrid_property
    def has_dataset(self):
        return bool(self.dataset)

    @hybrid_property
    def dataset_error(self):
        return self.dataset.error_message if self.dataset else None


class TaskItem(BaseModel):
    __tablename__ = "task_items"

    task_id = Column(Integer, ForeignKey("tasks.id"), index=True)
    item_id = Column(String, index=True)
    item_type = Column(Enum(TaskItemType), nullable=False)
    deleted = Column(Boolean, server_default="false")

    processed = Column(Boolean, server_default="false")
    error_type = Column(Enum(TaskItemErrorType))
    error_message = Column(String)

    __table_args__ = (
        PrimaryKeyConstraint("task_id", "item_id", "item_type"),
        {},
    )

    task = relationship("Task", back_populates="items")
    catalog_record = relationship(
        "CatalogRecord",
        primaryjoin="and_(TaskItem.item_id == CatalogRecord.sysno, "
        "TaskItem.item_type == 'CatalogRecord')",
        foreign_keys=item_id,
        viewonly=True,
    )
    document = relationship(
        "Document",
        primaryjoin="and_(TaskItem.item_id == Document.id, "
        "TaskItem.item_type == 'Document')",
        foreign_keys=item_id,
        viewonly=True,
    )

    @classmethod
    def find(
        cls, session: Session, task_id: int, item_id: str
    ) -> Optional["TaskItem"]:
        return (
            session.query(cls)
            .filter_by(task_id=task_id, item_id=item_id)
            .first()
        )

    @classmethod
    def query_base(cls, session) -> Query:
        return session.query(cls)

    @classmethod
    def get_page(
        cls, session: Session, task_id: int, page=1, page_size=50
    ) -> Tuple[List["TaskItem"], int]:
        if page < 1:
            raise InvalidPageNumberException()
        if page_size < 1:
            raise InvalidPageSizeException()

        offset = (page - 1) * page_size
        return (
            TaskItem.query_base(session)
            .filter_by(task_id=task_id)
            .offset(offset)
            .limit(page_size)
            .all(),
            TaskItem.query_base(session).filter_by(task_id=task_id).count(),
        )

    def is_persisted(self, session: Session) -> bool:
        return self.find(session, self.task_id, self.item_id) is not None


class TaskDataset(BaseModel):
    __tablename__ = "task_datasets"

    task_id = Column(
        Integer,
        ForeignKey("tasks.id"),
        primary_key=True,
        index=True,
    )
    data = Column(JSON)
    error_message = Column(String)

    task = relationship("Task", back_populates="dataset")


class PeriodicTask(BaseModel):
    __tablename__ = "periodic_tasks"

    id = Column(Integer, primary_key=True, index=True, unique=True)

    task_type = Column(Enum(TaskType), nullable=False)
    query_params = Column(JSON)
    minute = Column(Integer, nullable=False)
    hour = Column(Integer)
    day_of_week = Column(Integer)
    day_of_month = Column(Integer)

    def schedule(self):
        from worker import run_periodic_task_instance

        def parse_cron_value(value: Optional[str]) -> str:
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

    def save(self, session: Session) -> "PeriodicTask":
        super().save(session)
        self.schedule()
        return self

    def validate_before_delete(self, session: Session) -> None:
        vera_scheduler.remove_job(str(self.id))
