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
from services.database import Base
from tasks.types import TaskType, TaskState, TaskDocumentErrorType
from typing import List, Optional


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    process_id = Column(Integer)

    task_type = Column(Enum(TaskType))
    owner = Column(String, index=True)

    query = Column(String)

    task_state = Column(
        Enum(TaskState), server_default=TaskState.Planned.value
    )
    planned = Column(TIMESTAMP, server_default=func.now())
    started = Column(TIMESTAMP)
    finished = Column(TIMESTAMP)

    documents = relationship("TaskDocument", back_populates="task")
    dataset = relationship("TaskDataset", back_populates="task")

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

    @classmethod
    def find(cls, session: Session, task_id: int) -> Optional["Task"]:
        return session.query(cls).filter_by(id=task_id).first()

    @classmethod
    def get(cls, session: Session, task_id: int) -> "Task":
        task = cls.find(session, task_id)
        if task is None:
            raise ValueError(f"Task with id {task_id} not found")
        return task

    @classmethod
    def all(cls, session, page=1, page_size=50) -> List["Task"]:
        offset = (page - 1) * page_size
        return session.query(cls).offset(offset).limit(page_size).all()

    def save(self, session: Session) -> None:
        if self.id is None:
            session.add(self)
        session.commit()
        session.refresh(self)

    def delete(self, session: Session) -> None:
        session.delete(self)
        session.commit()


class TaskDocument(Base):
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


class TaskDataset(Base):
    __tablename__ = "task_datasets"

    task_id = Column(
        Integer, ForeignKey("tasks.id"), primary_key=True, index=True
    )
    data = Column(JSON)
    error_message = Column(String)

    task = relationship("Task", back_populates="dataset")
