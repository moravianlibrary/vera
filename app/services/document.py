import tempfile

import pandas as pd
from fastapi import BackgroundTasks
from fastapi.responses import FileResponse
from weasyprint import HTML

from adapters.indexer import IndexerQuery
from definitions.document import EXPORT_MEDIA_TYPE, ExportFormat, Priority
from definitions.task import DocumentTask, TaskScope
from repositories.category import CategoryRepository
from repositories.document import DocumentRepository
from repositories.document_iteration import DocumentIterationRepository
from repositories.models.document import DocumentModel
from repositories.models.task import TaskModel, TaskOrScheduleModel
from repositories.task import TaskRepository, TaskScheduleRepository
from schemas.document import (
    DocumentExportParams,
    DocumentGenerateListParams,
    DocumentsSyncParams,
    SetDigitizationDecisionTaskData,
    SetDocumentsCategoryTaskData,
    SetDocumentsPriorityTaskData,
    UpdatePageCountResponse,
)
from schemas.task import TaskScheduleParams
from services.task import TaskAndScheduleBasedService
from services.utils.background_tasks import remove_file

TASK_TYPE_NAMES_MAPPING = {
    DocumentTask.GenerateList: "Generate list from documents",
    DocumentTask.SetCategory: "Set category for documents",
    DocumentTask.SetPriority: "Set priority for documents",
    DocumentTask.SetDigitizationDecision: (
        "Set digitization decision for documents"
    ),
    DocumentTask.Reindex: "Reindex documents",
    DocumentTask.Sync: "Sync documents",
    DocumentTask.Delete: "Delete documents",
}


class DocumentService(TaskAndScheduleBasedService):
    _task_scope = TaskScope.Document
    _task_names_mapping = TASK_TYPE_NAMES_MAPPING

    def __init__(
        self,
        document_repository: DocumentRepository,
        document_iteration_repository: DocumentIterationRepository,
        category_repository: CategoryRepository,
        task_repository: TaskRepository,
        task_schedule_repository: TaskScheduleRepository,
    ):
        super().__init__(task_repository, task_schedule_repository)
        self._document_repository = document_repository
        self._document_iteration_repository = document_iteration_repository
        self._category_repository = category_repository

    async def export(
        self,
        query: IndexerQuery,
        params: DocumentExportParams,
        background_tasks: BackgroundTasks,
    ) -> FileResponse:
        data = []
        async for document in self._document_iteration_repository.search_all(
            query
        ):
            data.append(document)

        df = pd.DataFrame(data)
        header = getattr(query, "_source", None)

        if not header or len(header) == 0:
            # TODO: custom http exception
            raise ValueError("No fields specified for export")

        df = df.reindex(columns=header)

        suffix = f".{params.export_format.value}"

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            if params.export_format == ExportFormat.xlsx:
                df.to_excel(tmp.name, index=False)
            elif params.export_format == ExportFormat.csv:
                df.to_csv(tmp.name, index=False)
            elif params.export_format == ExportFormat.txt:
                df.to_csv(tmp.name, index=False, sep="\t")
            elif params.export_format == ExportFormat.pdf:
                HTML(string=df.to_html(index=False)).write_pdf(tmp.name)
            temp_file = tmp.name

        background_tasks.add_task(remove_file, temp_file),

        return FileResponse(
            temp_file,
            media_type=EXPORT_MEDIA_TYPE[params.export_format],
            filename=f"{params.filename}{suffix}",
            background=background_tasks,
        )

    async def generate_list(
        self,
        query: IndexerQuery,
        params: DocumentGenerateListParams,
        user_id: str,
    ) -> TaskModel:
        return await self._create_task(
            DocumentTask.GenerateList, user_id, query, params
        )

    def reset_page_count(
        self,
        document_model: DocumentModel,
    ) -> DocumentModel:
        if document_model.page_count_manual is not None:
            document_model.page_count = document_model.page_count_manual
            return self._document_repository.save(document_model)

        # TODO:
        # From somewhere take plugins with type document page count
        # and order them by priority
        # Then set the page count from the top priority
        # plugin that returns a value
        # If no plugin returns a value, set page count to None

        return self._document_repository.save(document_model)

    async def update_page_count(
        self, document_id: int, page_count: int
    ) -> UpdatePageCountResponse:
        document = self.reset_page_count(
            self._document_repository.update_manual_page_count(
                self._document_repository.get_by_id(document_id), page_count
            )
        )

        await self._document_iteration_repository.save_bulk(
            document.iterations, True
        )

        return UpdatePageCountResponse(
            document_id=document.id,
            new_page_count=document.page_count,
            iterations_updated=len(document.iterations),
        )

    async def set_category(
        self, query: IndexerQuery, category_id: int, created_by: str
    ) -> TaskModel:
        return await self._create_task(
            DocumentTask.SetCategory,
            created_by,
            query,
            SetDocumentsCategoryTaskData(category_id=category_id),
        )

    async def set_priority(
        self, query: IndexerQuery, priority: Priority, created_by: str
    ) -> TaskModel:
        return await self._create_task(
            DocumentTask.SetPriority,
            created_by,
            query,
            SetDocumentsPriorityTaskData(priority=priority),
        )

    async def set_digitization_decision(
        self, query: IndexerQuery, decline: bool, created_by: str
    ) -> TaskModel:
        return await self._create_task(
            DocumentTask.SetDigitizationDecision,
            created_by,
            query,
            SetDigitizationDecisionTaskData(decline=decline),
        )

    async def reindex(
        self,
        query: IndexerQuery,
        created_by: str,
        schedule_params: TaskScheduleParams,
    ) -> TaskOrScheduleModel:
        return await self._create_or_schedule_task(
            DocumentTask.Reindex, created_by, schedule_params, query
        )

    async def sync(
        self,
        query: IndexerQuery,
        sync_params: DocumentsSyncParams,
        created_by: str,
        schedule_params: TaskScheduleParams,
    ) -> TaskOrScheduleModel:
        return await self._create_or_schedule_task(
            DocumentTask.Sync,
            created_by,
            schedule_params,
            query,
            sync_params,
        )

    async def delete(self, query: IndexerQuery, created_by: str) -> TaskModel:
        return await self._create_task(DocumentTask.Delete, created_by, query)
