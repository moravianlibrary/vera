from typing import List

from adapters.indexer import IndexerQuery
from definitions.document import ExportFormat, Priority
from definitions.task import DocumentTask, TaskScope
from repositories.category import CategoryRepository
from repositories.document import DocumentRepository
from repositories.document_iteration import DocumentIterationRepository
from repositories.models.task import TaskModel
from services.task import TaskService

XLSX_MIMETYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)


class DocumentService:
    def __init__(
        self,
        document_repository: DocumentRepository,
        document_iteration_repository: DocumentIterationRepository,
        category_repository: CategoryRepository,
        task_service: TaskService,
    ):
        self._document_repository = document_repository
        self._document_iteration_repository = document_iteration_repository
        self._category_repository = category_repository
        self._task_service = task_service

    def export(
        query: IndexerQuery,
        fields: List[str],
        filename: str,
        export_format: ExportFormat,
    ):
        pass
        # df = pd.DataFrame(
        #     hit["_source"]
        #     for hit in query_documents(
        #         parse_query_routing(query_routing_params), user, es_session
        #     )["hits"]["hits"]
        # )

        # with tempfile.NamedTemporaryFile(
        #     suffix=".xlsx", delete=False
        # ) as temp_excel:
        #     df.to_excel(temp_excel.name, index=False)
        #     temp_filename = temp_excel.name

        # timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        # export_filename = f"vera-documents_{timestamp}.xlsx"

        # return FileResponse(
        #     temp_filename,
        #     media_type=XLSX_MIMETYPE,
        #     filename=export_filename,
        #     headers={"Content-Disposition": "attachment"},
        # )

    def update_page_count(
        self, document_id: int, page_count: int, user_id: str
    ) -> TaskModel:
        document_model = self._document_repository.get_by_id(document_id)

        self._document_repository.update_page_count(
            document_model, "manual", page_count
        )

        return self._task_service.init_task(
            TaskScope.Document,
            DocumentTask.Reindex,
            "Reindexing documents after page count update",
            user_id,
            data={"ids": [it.id for it in document_model.iterations]},
        )

    def set_category(
        self, query: IndexerQuery, category_id: int, user_id: str
    ) -> TaskModel:
        return self._task_service.init_task(
            TaskScope.Document,
            DocumentTask.SetCategory,
            "Setting category for documents",
            user_id,
            data={"category_id": category_id},
            query=query,
        )

    def set_priority(
        self, query: IndexerQuery, priority: Priority, user_id: str
    ) -> TaskModel:
        return self._task_service.init_task(
            TaskScope.Document,
            DocumentTask.SetPriority,
            "Setting priority for documents",
            user_id,
            data={"priority": priority},
            query=query,
        )

    def delete(self, query: IndexerQuery, user_id: str) -> TaskModel:
        return self._task_service.init_task(
            TaskScope.Document,
            DocumentTask.Delete,
            "Deleting documents",
            user_id,
            query=query,
        )
