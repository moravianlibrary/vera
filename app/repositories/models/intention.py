from typing import TYPE_CHECKING, List

from sqlalchemy import TIMESTAMP, Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped

from adapters.database import BaseModel, connected_with, has_one

from .associations import digitization_list_intention_association

if TYPE_CHECKING:
    from .digitization_list import DigitizationListModel
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

    digitization_lists: Mapped[List["DigitizationListModel"]] = connected_with(
        "DigitizationListModel",
        digitization_list_intention_association,
        "intentions",
    )
    project: Mapped["ProjectModel"] = has_one("ProjectModel", "intention")
