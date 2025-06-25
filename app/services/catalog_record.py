from adapters.indexer import IndexerQuery
from definitions.task import CatalogRecordTask, TaskScope
from repositories.catalog_record import CatalogRecordRepository
from repositories.models.task import TaskModel
from services.task import TaskService

TASK_TYPE_NAMES_MAPPING = {
    CatalogRecordTask.Reindex: "Reindex catalog records",
    CatalogRecordTask.Sync: "Sync catalog records",
    CatalogRecordTask.SetValid: "Set catalog records validity to valid",
    CatalogRecordTask.SetInvalid: "Set catalog records validity to invalid",
    CatalogRecordTask.ArchiveInactive: "Archive inactive catalog records",
    CatalogRecordTask.Delete: "Delete catalog records",
}


class CatalogRecordService:
    def __init__(
        self,
        catalog_record_repository: CatalogRecordRepository,
        task_service: TaskService,
    ):
        self._catalog_record_repository = catalog_record_repository
        self._task_service = task_service

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
        return self.init_query_task(
            query,
            (
                CatalogRecordTask.SetValid
                if is_valid
                else CatalogRecordTask.SetInvalid
            ),
            created_by,
        )

    def archive_inactive(self, created_by: str) -> TaskModel:
        return self._task_service.init_task(
            TaskScope.CatalogRecord,
            CatalogRecordTask.ArchiveInactive,
            TASK_TYPE_NAMES_MAPPING[CatalogRecordTask.ArchiveInactive],
            created_by,
        )
