from sqlalchemy import (
    Boolean,
    Column,
    Enum,
    ForeignKey,
    Integer,
    PrimaryKeyConstraint,
    String,
    TIMESTAMP,
    func,
    case,
)
from sqlalchemy.orm import Session

from services.database import Base
from tasks.enums import TaskDocumentErrorType, TaskType, TaskState


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    process_id = Column(Integer)

    task_type = Column(Enum(TaskType))
    query = Column(String)
    owner = Column(String, index=True)

    task_state = Column(
        Enum(TaskState), server_default=TaskState.Planned.value
    )
    planned = Column(TIMESTAMP, server_default=func.now())
    started = Column(TIMESTAMP)
    finished = Column(TIMESTAMP)


class TaskDocument(Base):
    __tablename__ = "task_documents"

    task_id = Column(Integer, ForeignKey("tasks.id"), index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), index=True)

    processed = Column(Boolean, server_default="false")
    error_type = Column(Enum(TaskDocumentErrorType))
    error_message = Column(String)

    __table_args__ = (PrimaryKeyConstraint("task_id", "document_id"), {})


def task_view(db: Session):
    return (
        db.query(
            Task.id,
            Task.process_id,
            Task.task_type,
            Task.query,
            Task.owner,
            Task.task_state,
            Task.planned,
            Task.started,
            Task.finished,
            (
                func.sum(case((TaskDocument.processed, 1), else_=0)).label(
                    "processed_count"
                )
            ),
            func.count(TaskDocument.document_id).label("total_count"),
            (
                func.sum(
                    case((TaskDocument.error_type is None, 0), else_=1)
                ).label("error_count")
            ),
        )
        .join(TaskDocument, Task.id == TaskDocument.task_id)
        .group_by(Task.id)
    )
