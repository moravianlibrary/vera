from typing import List

from adapters.indexer import IndexerQuery
from definitions.task import AdditionTask, TaskScope
from repositories import AdditionRepository, TaskRepository
from repositories.addition import AdditionBatchRepository
from repositories.models.task import TaskModel
from schemas.addition import (
    AdditionCreate,
    AdditionsSettingsParams,
    IngestAdditionsResponse,
    IngestAdditionsTaskData,
    ReingestAdditionsTaskData,
)
from schemas.common import BatchParams
from services.task import TaskBasedService


class AdditionService(TaskBasedService):
    _task_scope = TaskScope.Addition
    _task_names_mapping = {
        AdditionTask.Ingest: "Ingest additions",
        AdditionTask.Reingest: "Reingest additions",
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

    async def ingest(
        self,
        additions: List[AdditionCreate],
        batch_params: BatchParams,
        ingest_params: AdditionsSettingsParams,
        created_by: str,
    ) -> IngestAdditionsResponse:
        batch = self._batch_repository.get_or_create(batch_params, created_by)

        task = await self._create_task(
            AdditionTask.Ingest,
            created_by,
            data=IngestAdditionsTaskData(
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

    async def reingest(
        self,
        query: IndexerQuery,
        ingest_params: AdditionsSettingsParams,
        created_by: str,
    ) -> TaskModel:
        return await self._create_task(
            AdditionTask.Reingest,
            created_by,
            query,
            ReingestAdditionsTaskData(
                allow_new_iteration=ingest_params.allow_new_iteration,
                ignore_digitization_check=(
                    ingest_params.ignore_digitization_check
                ),
            ),
        )

    def delete(self, query: IndexerQuery, created_by: str) -> TaskModel:
        return self._create_task(AdditionTask.Delete, created_by, query)
