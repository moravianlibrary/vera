from adapters.database import DatabaseSession
from definitions.document import Priority
from repositories.models.document import DocumentIterationModel

from ._base import BaseRepository
from ._database_mixins import (
    ArchiveMixin,
    GetByIdMixin,
    GetByQueryMixin,
    IndexMixin,
    SaveAndIndexMixin,
    SearchMixin,
)


class DocumentIterationRepository(
    BaseRepository,
    ArchiveMixin[DocumentIterationModel],
    GetByIdMixin[DocumentIterationModel, int],
    GetByQueryMixin[DocumentIterationModel],
    IndexMixin[DocumentIterationModel],
    SaveAndIndexMixin[DocumentIterationModel],
    SearchMixin[DocumentIterationModel],
):
    def __init__(self, database_session: DatabaseSession):
        super().__init__(
            database_session, DocumentIterationModel, "Document Iteration"
        )

    def create(
        self, document_id: int, category_id: int, priority: Priority
    ) -> DocumentIterationModel:
        iteration = (
            self._database_session.query(DocumentIterationModel)
            .filter(DocumentIterationModel.document_id == document_id)
            .count()
            + 1
        )

        return self.save_and_index(
            DocumentIterationModel(
                document_id=document_id,
                iteration=iteration,
                category_id=category_id,
                priority=priority,
            )
        )

    def update_category(
        self,
        document_iteration_model: DocumentIterationModel,
        category_id: int,
    ) -> DocumentIterationModel:
        document_iteration_model.category_id = category_id
        return self.save_and_index(document_iteration_model)

    def update_priority(
        self,
        document_iteration_model: DocumentIterationModel,
        priority: Priority,
    ) -> DocumentIterationModel:
        document_iteration_model.priority = priority
        return self.save_and_index(document_iteration_model)

    def update_digitization_list(
        self,
        document_iteration_model: DocumentIterationModel,
        digitization_list_id: int | None,
    ) -> DocumentIterationModel:
        document_iteration_model.digitization_list_id = digitization_list_id
        return self.save_and_index(document_iteration_model)
