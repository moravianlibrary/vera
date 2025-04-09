from sqlalchemy import TIMESTAMP, Boolean, Column, Integer, String
from sqlalchemy.orm import relationship

from adapters.database import BaseModel

from .mixins import UpdatedAuditLogMixin


class ProjectModel(BaseModel):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True)

    name = Column(String, unique=True, nullable=False)
    description = Column(String)

    target_page_count = Column(Integer)
    start_date = Column(TIMESTAMP)
    end_date = Column(TIMESTAMP)

    status = Column(String, nullable=True)

    is_archived = Column(Boolean, default=False, nullable=False)


class ProjectStatusLogModel(BaseModel, UpdatedAuditLogMixin):
    pass
