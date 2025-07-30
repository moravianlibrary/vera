from adapters.indexer import IndexerQuery
from definitions.task import CatalogRecordTask, TaskScope
from repositories.catalog_record import CatalogRecordRepository
from repositories.models.task import TaskModel
from schemas.catalog_record import CatalogRecordForceValidityData
from services.task import TaskBasedService

TASK_TYPE_NAMES_MAPPING = {
    CatalogRecordTask.Reindex: "Reindex catalog records",
    CatalogRecordTask.Sync: "Sync catalog records",
    CatalogRecordTask.SetForcedValidity: "Set catalog records validity to valid",
    CatalogRecordTask.ArchiveInactive: "Archive inactive catalog records",
    CatalogRecordTask.Delete: "Delete catalog records",
}


class CatalogRecordService(TaskBasedService):
    def __init__(
        self,
        catalog_record_repository: CatalogRecordRepository,
    ):
        self._catalog_record_repository = catalog_record_repository

    def init_query_task(
        self,
        query: IndexerQuery,
        task_type: CatalogRecordTask,
        created_by: str,
    ) -> TaskModel:
        return self._task_service.init_task(
            TaskScope.CatalogRecord,
            task_type,
            TASK_TYPE_NAMES_MAPPING[task_type],
            created_by,
            query=query,
        )

    def set_validity(
        self,
        query: IndexerQuery,
        is_valid: bool,
        created_by: str,
    ) -> TaskModel:
        return self._create_task(
            CatalogRecordTask.SetForcedValidity,
            created_by,
            CatalogRecordForceValidityData(is_valid=is_valid),
            query,
        )

    def archive_inactive(self, created_by: str) -> TaskModel:
        return self._task_service.init_task(
            TaskScope.CatalogRecord,
            CatalogRecordTask.ArchiveInactive,
            TASK_TYPE_NAMES_MAPPING[CatalogRecordTask.ArchiveInactive],
            created_by,
        )
