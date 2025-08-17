from typing import TYPE_CHECKING, Dict, List

from sqlalchemy import Column, Enum, Integer, func, select
from sqlalchemy.orm import Mapped

from adapters.database import (
    BaseModel,
    DatabaseSession,
    connected_with,
    contains,
    db_view,
)
from definitions.digitization_registry import DigitizationListState

from .associations import digitization_list_intention_association
from .document import DocumentIterationModel, DocumentModel
from .mixins.created_audit import CreatedAuditMixin

if TYPE_CHECKING:
    from .intention import IntentionModel
    from .task import TaskDigitizationListModel


class DigitizationListModel(BaseModel, CreatedAuditMixin):
    __tablename__ = "digitization_lists"

    id = Column(Integer, primary_key=True)
    state = Column(Enum(DigitizationListState), nullable=False)

    document_iterations: Mapped[List["DocumentIterationModel"]] = contains(
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

    @db_view
    def get_statistics(self, db_session: DatabaseSession) -> Dict[str, int]:
        stmt = (
            select(
                func.count(DocumentIterationModel.id).label("count_documents"),
                func.coalesce(
                    func.sum(
                        DocumentModel.page_count,
                    ),
                    0,
                ).label("count_pages"),
            )
            .join(
                DocumentModel,
                DocumentIterationModel.document_id == DocumentModel.id,
            )
            .filter(DocumentIterationModel.digitization_list_id == self.id)
        )

        return db_session.execute(stmt).first()._mapping
