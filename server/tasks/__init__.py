from .generate_items_pages_dataset import GenerateItemsPagesDataset
from .generate_volumes_pages_dataset import GenerateVolumesPagesDataset
from .predict_periodicals_page_count import PredictPeriodicalsPageCount
from .reevaluate_catalog_records_differences import (
    ReevaluateCatalogRecordsDifferences,
)
from .reindex_catalog_records import ReindexCatalogRecords
from .reindex_documents import ReindexDocuments
from .sync_catalog_records_with_catalogs import SyncCatalogRecordsWithCatalogs
from .sync_documents_with_catalogs import SyncDocumentsWithCatalogs
from .sync_documents_with_digitization_registry import (
    SyncDocumentsWithDigitizationRegistry,
)
from .recreate_indexes import RecreateIndexes
from datatypes import TaskType

TaskDispatcher = {
    TaskType.PredictPeriodicalsPageCount: PredictPeriodicalsPageCount,
    TaskType.ReindexDocuments: ReindexDocuments,
    TaskType.SyncDocumentsWithCatalogs: SyncDocumentsWithCatalogs,
    TaskType.SyncDocumentsWithDigitizationRegistry: (
        SyncDocumentsWithDigitizationRegistry
    ),
    TaskType.ReindexCatalogRecords: ReindexCatalogRecords,
    TaskType.SyncCatalogRecordsWithCatalogs: SyncCatalogRecordsWithCatalogs,
    TaskType.ReevaluateCatalogRecordsDifferences: (
        ReevaluateCatalogRecordsDifferences
    ),
    TaskType.GenerateVolumesPagesDataset: GenerateVolumesPagesDataset,
    TaskType.GenerateItemsPagesDataset: GenerateItemsPagesDataset,
    TaskType.RecreateIndexes: RecreateIndexes,
}

__all__ = [
    "TaskDispatcher",
]
