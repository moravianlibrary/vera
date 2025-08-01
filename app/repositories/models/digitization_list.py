from typing import TYPE_CHECKING, List

from sqlalchemy import Column, Enum, Integer
from sqlalchemy.orm import Mapped

from adapters.database import BaseModel, connected_with, contains, has_one
from definitions.digitization_registry import DigitizationListState

from .associations import digitization_list_intention_association
from .mixins.created_audit import CreatedAuditMixin

if TYPE_CHECKING:
    from .document import DocumentIterationModel
    from .intention import IntentionModel
    from .task import TaskDigitizationListModel


class DigitizationListModel(BaseModel, CreatedAuditMixin):
    __tablename__ = "digitization_lists"

    id = Column(Integer, primary_key=True)
    state = Column(Enum(DigitizationListState), nullable=False)

    document_iterations: Mapped[List["DocumentIterationModel"]] = has_one(
        "DocumentIterationModel", "digitization_list"
    )
    intentions: Mapped[List["IntentionModel"]] = connected_with(
        "IntentionModel",
        digitization_list_intention_association,
        "digitization_lists",
    )
    task_items: Mapped[List["TaskDigitizationListModel"]] = contains(
        "TaskDigitizationListModel", "digitization_list"
    )
