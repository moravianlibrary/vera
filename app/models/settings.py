from sqlalchemy import Column, Integer, Boolean, Enum, asc
from sqlalchemy.orm import Session, Query
from datatypes import TaskType, TaskItemType
from .base import BaseModel


class StartupTasks(BaseModel):
    __tablename__ = "startup_tasks"

    id = Column(Integer, primary_key=True, index=True, unique=True)
    task_type = Column(Enum(TaskType), nullable=False)
    item_type = Column(Enum(TaskItemType))
    is_one_time_task = Column(Boolean, server_default="false")
    has_run = Column(Boolean, server_default="false")

    @classmethod
    def query_base(cls, session: Session) -> Query:
        return session.query(cls).order_by(asc(cls.id))
