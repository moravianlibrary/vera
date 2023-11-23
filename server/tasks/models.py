from sqlalchemy import Boolean, Column, Enum, ForeignKey, Integer, \
    PrimaryKeyConstraint, String, TIMESTAMP, func

from services.database import Base
from tasks.enums import TaskType, TaskScope, TaskState


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    process_id = Column(Integer)

    task_type = Column(Enum(TaskType))
    task_scope = Column(Enum(TaskScope))
    query = Column(String)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)

    task_state = Column(Enum(TaskState),
                        server_default=TaskState.PLANNED.value)
    planned = Column(TIMESTAMP, server_default=func.now())
    started = Column(TIMESTAMP)
    finished = Column(TIMESTAMP)


class TaskDocument(Base):
    __tablename__ = "task_documents"

    task_id = Column(Integer, ForeignKey("tasks.id"), index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), index=True)
    processed = Column(Boolean, server_default='false')

    __table_args__ = (PrimaryKeyConstraint('task_id', 'document_id'), {})


class TaskView(Base):
    __tablename__ = "task_view"

    id = Column(Integer, primary_key=True, index=True)

    task_type = Column(Enum(TaskType))
    task_scope = Column(Enum(TaskScope))
    query = Column(String)

    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    owner_name = Column(String, ForeignKey("users.username"))

    task_state = Column(Enum(TaskState),
                        server_default=TaskState.PLANNED.value)
    planned = Column(TIMESTAMP, server_default=func.now())
    started = Column(TIMESTAMP)
    finished = Column(TIMESTAMP)

    processed_count = Column(Integer)
    total_count = Column(Integer)
