from typing import List

from adapters.indexer import IndexerQuery
from definitions.task import AdditionTask, TaskScope
from repositories import AdditionRepository, TaskRepository
from repositories.addition import AdditionBatchRepository
from repositories.models.addition import AdditionBatchModel
from repositories.models.task import TaskModel
from schemas.addition import (
    AdditionCreate,
    AdditionsBatchParams,
    AdditionsSettingsParams,
    IngestAdditionsResponse,
    IngestBatchAdditionsTaskData,
    ReingestAdditionsTaskData,
)
from services.task import TaskBasedService


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
        batch_repository: AdditionBatchRepository,
        task_repository: TaskRepository,
    ):
        super().__init__(task_repository)
        self._addition_repository = addition_repository
        self._batch_repository = batch_repository

    def _ensure_batch(
        self, batch_params: AdditionsBatchParams, created_by: str
    ) -> AdditionBatchModel:
        if batch_params.batch_id is None:
            return self._batch_repository.create(
                batch_params.batch_name, batch_params.file_name, created_by
            )

        batch = self._batch_repository.get_by_id(batch_params.batch_id)

        if batch.created_by != created_by:
            raise PermissionError(
                "You do not have permission to access this batch."
            )

        return batch

    async def ingest(
        self,
        additions: List[AdditionCreate],
        batch_params: AdditionsBatchParams,
        ingest_params: AdditionsSettingsParams,
        created_by: str,
    ) -> IngestAdditionsResponse:
        batch = self._ensure_batch(batch_params, created_by)

        task = await self._create_task(
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

        return IngestAdditionsResponse(
            task=self._serialize_task(task), batch_id=batch.id
        )

    def reingest(
        self,
        query: IndexerQuery,
        ingest_params: AdditionsSettingsParams,
        created_by: str,
    ) -> TaskModel:
        return self._create_task(
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
        return self._create_task(AdditionTask.Archive, created_by, query=query)

    def delete(self, query: IndexerQuery, created_by: str) -> TaskModel:
        return self._create_task(AdditionTask.Delete, created_by, query=query)
