from typing import TYPE_CHECKING

from sqlalchemy import TIMESTAMP, Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, relationship

from adapters.database import BaseModel

if TYPE_CHECKING:
    from .project import ProjectModel


class IntentionModel(BaseModel):
    __tablename__ = "intentions"

    id = Column(Integer, primary_key=True)

    name = Column(String, unique=True, nullable=False)
    description = Column(String)

    target_page_count = Column(Integer)
    start_date = Column(TIMESTAMP)
    end_date = Column(TIMESTAMP)

    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)

    is_archived = Column(Boolean, default=False, nullable=False)

    project: Mapped["ProjectModel"] = relationship(
        "ProjectModel",
        back_populates="intention",
        lazy="joined",
    )
