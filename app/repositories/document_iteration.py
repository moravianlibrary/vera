from adapters.database import DatabaseSession
from adapters.indexer import IndexerSession
from definitions.document import Priority
from schemas.document import Document

from ._db_indexed_repository import DbIndexedRepository, GetByQueryMixin
from ._db_repository import GetByIdMixin
from .models.document import DocumentIterationModel


class DocumentIterationRepository(
    DbIndexedRepository[DocumentIterationModel, Document],
    GetByIdMixin[DocumentIterationModel, int],
    GetByQueryMixin[DocumentIterationModel, Document],
):
    def __init__(
        self,
        database_session: DatabaseSession,
        indexer_session: IndexerSession,
    ):
        super().__init__(
            "DocumentIteration",
            database_session,
            DocumentIterationModel,
            indexer_session,
            Document,
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

        return self.save(
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
        return self.save(document_iteration_model)

    def update_priority(
        self,
        document_iteration_model: DocumentIterationModel,
        priority: Priority,
    ) -> DocumentIterationModel:
        document_iteration_model.priority = priority
        return self.save(document_iteration_model)

    def update_digitization_list(
        self,
        document_iteration_model: DocumentIterationModel,
        digitization_list_id: int | None,
    ) -> DocumentIterationModel:
        document_iteration_model.digitization_list_id = digitization_list_id
        return self.save(document_iteration_model)
