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
from sqlalchemy.orm import relationship

from services.database import Base

from tasks.types import (
    TaskDocumentErrorType,
    TaskType,
    TaskState,
)


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
