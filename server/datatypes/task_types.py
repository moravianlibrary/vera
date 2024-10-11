from enum import Enum


class TaskType(Enum):
    GenerateVolumesPagesDataset = "GenerateVolumesPagesDataset"
    GenerateItemsPagesDataset = "GenerateItemsPagesDataset"
    RecreateIndexes = "RecreateIndexes"

    PredictPeriodicalsPageCount = "PredictPeriodicalsPageCount"
    ReindexDocuments = "ReindexDocuments"
    SyncDocumentsWithCatalogs = "SyncDocumentsWithCatalogs"
    SyncDocumentsWithDigitizationRegistry = (
        "SyncDocumentsWithDigitizationRegistry"
    )

    ReindexCatalogRecords = "ReindexCatalogRecords"
    SyncCatalogRecordsWithCatalogs = "SyncCatalogRecordsWithCatalogs"
    ReevaluateCatalogRecordsDifferences = "ReevaluateCatalogRecordsDifferences"


def is_catalog_records_task(task_type: TaskType) -> bool:
    return task_type in [
        TaskType.ReindexCatalogRecords,
        TaskType.SyncCatalogRecordsWithCatalogs,
        TaskType.ReevaluateCatalogRecordsDifferences,
    ]


def is_documents_task(task_type: TaskType) -> bool:
    return task_type in [
        TaskType.PredictPeriodicalsPageCount,
        TaskType.ReindexDocuments,
        TaskType.SyncDocumentsWithCatalogs,
        TaskType.SyncDocumentsWithDigitizationRegistry,
    ]


class TaskState(Enum):
    Planned = "Planned"
    Running = "Running"
    Finished = "Finished"
    Failed = "Failed"
    Killed = "Killed"


class TaskItemType(Enum):
    CatalogRecord = "CatalogRecord"
    Document = "Document"


class TaskItemErrorType(Enum):
    ValueError = "ValueError"
    UnknownError = "UnknownError"
