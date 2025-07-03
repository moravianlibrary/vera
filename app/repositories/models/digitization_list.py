from typing import TYPE_CHECKING, List

from sqlalchemy import Column, Enum, Integer
from sqlalchemy.orm import Mapped, relationship

from adapters.database import BaseModel
from definitions.digitization_registry import DigitizationListState

from .associations import digitization_list_intention_association
from .mixins.created_audit import CreatedAuditMixin

if TYPE_CHECKING:
    from .document import DocumentIterationModel
    from .intention import IntentionModel


class DigitizationListModel(BaseModel, CreatedAuditMixin):
    __tablename__ = "digitization_lists"

    id = Column(Integer, primary_key=True)
    state = Column(Enum(DigitizationListState), nullable=False)

    document_iterations: Mapped[List["DocumentIterationModel"]] = relationship(
        "DocumentModel",
        back_populates="digitization_list",
        lazy="joined",
        cascade="all, delete-orphan",
    )
    intentions: Mapped[List["IntentionModel"]] = relationship(
        "IntentionModel",
        secondary=digitization_list_intention_association,
        back_populates="digitization_lists",
        lazy="joined",
        cascade="all, delete-orphan",
    )
