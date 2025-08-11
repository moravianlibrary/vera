from fastapi import HTTPException, status

from adapters.indexer import IndexerQuery
from definitions.task import CatalogRecordTask, TaskScope
from repositories.catalog_record import CatalogRecordRepository
from repositories.models.task import TaskModel, TaskOrScheduleModel
from repositories.task import TaskRepository, TaskScheduleRepository
from schemas.catalog_record import (
    CatalogRecordForceValidityData,
    CatalogRecordsSyncParams,
    MarkInReviewParams,
)
from schemas.task import TaskScheduleParams
from services.task import TaskAndScheduleBasedService

TASK_TYPE_NAMES_MAPPING = {
    CatalogRecordTask.Reindex: "Reindex catalog records",
    CatalogRecordTask.Sync: "Sync catalog records",
    CatalogRecordTask.SetForcedValidity: {
        True: "Set forced validity for catalog records",
        False: "Reset forced validity for catalog records",
    },
    CatalogRecordTask.MarkInReview: {
        True: "Mark catalog records as in review",
        False: "Unmark catalog records as in review",
    },
    CatalogRecordTask.ArchiveInactive: "Archive inactive catalog records",
    CatalogRecordTask.Delete: "Delete catalog records",
}


class CatalogRecordService(TaskAndScheduleBasedService):
    _task_scope = TaskScope.CatalogRecord
    _task_names_mapping = TASK_TYPE_NAMES_MAPPING

    def __init__(
        self,
        catalog_record_repository: CatalogRecordRepository,
        task_repository: TaskRepository,
        task_schedule_repository: TaskScheduleRepository,
    ):
        super().__init__(task_repository, task_schedule_repository)
        self._catalog_record_repository = catalog_record_repository

    async def reindex(
        self,
        query: IndexerQuery,
        created_by: str,
        schedule_params: TaskScheduleParams,
    ) -> TaskOrScheduleModel:
        return await self._create_or_schedule_task(
            CatalogRecordTask.Reindex, created_by, schedule_params, query
        )

    async def sync(
        self,
        query: IndexerQuery,
        sync_params: CatalogRecordsSyncParams,
        created_by: str,
        schedule_params: TaskScheduleParams,
    ) -> TaskOrScheduleModel:
        if not sync_params.from_catalog and not sync_params.properties:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one sync parameter must be enabled.",
            )
        return await self._create_or_schedule_task(
            CatalogRecordTask.Sync,
            created_by,
            schedule_params,
            query,
            sync_params,
        )

    async def set_forced_validity(
        self,
        query: IndexerQuery,
        validity: bool,
        created_by: str,
    ) -> TaskModel:
        return await self._create_task(
            CatalogRecordTask.SetForcedValidity,
            created_by,
            query,
            CatalogRecordForceValidityData(validity=validity),
            self._task_names_mapping[CatalogRecordTask.SetForcedValidity][
                validity
            ],
        )

    async def mark_in_review(
        self,
        query: IndexerQuery,
        in_review_params: MarkInReviewParams,
        created_by: str,
    ) -> TaskModel:
        return await self._create_task(
            CatalogRecordTask.MarkInReview,
            created_by,
            query,
            in_review_params,
            self._task_names_mapping[CatalogRecordTask.MarkInReview][
                in_review_params.in_review
            ],
        )

    async def archive_inactive(
        self, created_by: str, schedule_params: TaskScheduleParams
    ) -> TaskModel:
        return await self._create_or_schedule_task(
            CatalogRecordTask.ArchiveInactive, created_by, schedule_params
        )

    async def delete(self, query: IndexerQuery, created_by: str) -> TaskModel:
        return await self._create_task(
            CatalogRecordTask.Delete, created_by, query
        )
