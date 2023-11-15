from sqlalchemy import Boolean, Column, Enum, ForeignKey, Integer, PrimaryKeyConstraint, String, TIMESTAMP, func
from sqlalchemy.orm import relationship

from services.database import Base
from tasks.enums import TaskType, TaskScope, TaskState


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)

    task_type = Column(Enum(TaskType))
    task_scope = Column(Enum(TaskScope))
    query = Column(String)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)

    task_state = Column(Enum(TaskState), server_default=TaskState.PLANNED.value)
    planned = Column(TIMESTAMP, server_default=func.now())
    started = Column(TIMESTAMP)
    finished = Column(TIMESTAMP)


class TaskRecordsProcessed(Base):
    __tablename__ = "task_records_processed"

    task_id = Column(Integer, ForeignKey("tasks.id"), index=True)
    record_id = Column(Integer, ForeignKey("records.id"), index=True)
    processed = Column(Boolean, server_default='false')

    __table_args__ = (PrimaryKeyConstraint('task_id', 'record_id'), {})


class TaskView(Base):
    __tablename__ = "task_view"

    id = Column(Integer, primary_key=True, index=True)

    task_type = Column(Enum(TaskType))
    task_scope = Column(Enum(TaskScope))
    query = Column(String)

    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    owner_name = Column(String, ForeignKey("users.username"))

    task_state = Column(Enum(TaskState), server_default=TaskState.PLANNED.value)
    planned = Column(TIMESTAMP, server_default=func.now())
    started = Column(TIMESTAMP)
    finished = Column(TIMESTAMP)

    processed_count = Column(Integer)
    total_count = Column(Integer)
