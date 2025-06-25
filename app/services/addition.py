from typing import List

from adapters.indexer import IndexerQuery
from definitions.task import AdditionTask, TaskScope
from repositories import AdditionRepository
from repositories.models.task import TaskModel
from schemas.addition import (
    AdditionBatchParams,
    AdditionCreate,
    IngestAdditionsParams,
    IngestAdditionsResponse,
    IngestBatchAdditionsTaskData,
    ReingestAdditionsTaskData,
)
from services.task import TaskBasedService, TaskService


class AdditionService(TaskBasedService):
    _task_scope = TaskScope.Addition
    _task_names_mapping = {
        AdditionTask.Ingest: "Ingest additions",
        AdditionTask.Reingest: "Reingest additions",
        AdditionTask.Archive: "Archive additions",
        AdditionTask.Delete: "Delete additions",
    }

    def __init__(
        self,
        addition_repository: AdditionRepository,
        task_service: TaskService,
    ):
        super().__init__(task_service)
        self._addition_repository = addition_repository

    def _ensure_batch(self, batch_params: AdditionBatchParams):
        if batch_params.batch_id:
            return self._addition_repository.get_batch_by_id(
                batch_params.batch_id
            )
        return self._addition_repository.create_batch(
            batch_params.batch_name, batch_params.file_name
        )

    def ingest(
        self,
        additions: List[AdditionCreate],
        batch_params: AdditionBatchParams,
        ingest_params: IngestAdditionsParams,
        created_by: str,
    ) -> IngestAdditionsResponse:
        batch = self._ensure_batch(batch_params)

        task = self._create_task(
            AdditionTask.Ingest,
            created_by,
            data=IngestBatchAdditionsTaskData(
                batch_id=batch.id,
                additions=additions,
                allow_new_iteration=ingest_params.allow_new_iteration,
                ignore_digitization_check=(
                    ingest_params.ignore_digitization_check
                ),
            ),
        )

        return IngestAdditionsResponse(task=task, batch_id=batch.id)

    def reingest(
        self,
        query: IndexerQuery,
        ingest_params: IngestAdditionsParams,
        created_by: str,
    ) -> TaskModel:
        return self._task_service.create_task(
            AdditionTask.Reingest,
            created_by,
            data=ReingestAdditionsTaskData(
                allow_new_iteration=ingest_params.allow_new_iteration,
                ignore_digitization_check=(
                    ingest_params.ignore_digitization_check
                ),
            ),
            query=query,
        )

    def archive(self, query: IndexerQuery, created_by: str) -> TaskModel:
        return self._task_service.init_task(
            AdditionTask.Archive, created_by, query=query
        )

    def delete(self, query: IndexerQuery, created_by: str) -> TaskModel:
        return self._task_service.init_task(
            AdditionTask.Delete, created_by, query=query
        )
