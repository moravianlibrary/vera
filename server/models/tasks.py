from sqlalchemy import (
    Boolean,
    Column,
    Enum,
    func,
    ForeignKey,
    Integer,
    JSON,
    PrimaryKeyConstraint,
    String,
    TIMESTAMP,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import relationship, Session
from datatypes import TaskType, TaskState, TaskDocumentErrorType
from .base import BaseModel
from typing import Optional


class Task(BaseModel):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True, unique=True)
    process_id = Column(Integer)

    task_type = Column(Enum(TaskType), nullable=False, index=True)
    owner = Column(String, nullable=False, index=True)

    query_params = Column(JSON)

    task_state = Column(
        Enum(TaskState), nullable=False, server_default=TaskState.Planned.value
    )
    planned = Column(TIMESTAMP, server_default=func.now())
    started = Column(TIMESTAMP)
    finished = Column(TIMESTAMP)

    documents = relationship("TaskDocument", back_populates="task")
    dataset = relationship("TaskDataset", back_populates="task", uselist=False)

    @hybrid_property
    def processed_count(self):
        return sum(1 for document in self.documents if document.processed)

    @hybrid_property
    def total_count(self):
        return len(self.documents)

    @hybrid_property
    def error_count(self):
        return sum(1 for document in self.documents if document.error_type)

    @hybrid_property
    def has_dataset(self):
        return bool(self.dataset)

    @hybrid_property
    def dataset_error(self):
        return self.dataset.error_message if self.dataset else None


class TaskDocument(BaseModel):
    __tablename__ = "task_documents"

    task_id = Column(Integer, ForeignKey("tasks.id"), index=True)
    document_id = Column(Integer, index=True)
    deleted = Column(Boolean, server_default="false")

    processed = Column(Boolean, server_default="false")
    error_type = Column(Enum(TaskDocumentErrorType))
    error_message = Column(String)

    __table_args__ = (PrimaryKeyConstraint("task_id", "document_id"), {})

    task = relationship("Task", back_populates="documents")
    document = relationship(
        "Document",
        primaryjoin="TaskDocument.document_id == Document.id",
        back_populates="task_documents",
        foreign_keys=document_id,
    )

    @classmethod
    def find(
        cls, session: Session, task_id: int, document_id: int
    ) -> Optional["TaskDocument"]:
        return (
            session.query(cls)
            .filter_by(task_id=task_id, document_id=document_id)
            .first()
        )

    def is_persisted(self, session: Session) -> bool:
        return self.find(session, self.task_id, self.document_id) is not None


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
