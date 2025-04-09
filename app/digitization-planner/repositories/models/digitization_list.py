from typing import TYPE_CHECKING, List

from associations import digitization_list_intention_association
from sqlalchemy import Boolean, Column, Integer
from sqlalchemy.orm import Mapped, relationship

from adapters.database import BaseModel

from .mixins import CreatedAuditMixin

if TYPE_CHECKING:
    from .document import DocumentModel
    from .intention import IntentionModel


class DigitizationListModel(BaseModel, CreatedAuditMixin):
    __tablename__ = "digitization_lists"

    id = Column(Integer, primary_key=True)

    is_archived = Column(Boolean, default=False, nullable=False)

    documents: Mapped[List["DocumentModel"]] = relationship(
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
