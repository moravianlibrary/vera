enum TaskType {
    GenerateVolumesPagesDataset = "GenerateVolumesPagesDataset",
    GenerateItemsPagesDataset = "GenerateItemsPagesDataset",
    RecreateIndexes = "RecreateIndexes",
    PredictPeriodicalsPageCount = "PredictPeriodicalsPageCount",
    ReindexDocuments = "ReindexDocuments",
    SyncDocumentsWithCatalogs = "SyncDocumentsWithCatalogs",
    SyncDocumentsWithDigitizationRegistry = "SyncDocumentsWithDigitizationRegistry",
    ReindexCatalogRecords = "ReindexCatalogRecords",
    SyncCatalogRecordsWithCatalogs = "SyncCatalogRecordsWithCatalogs",
    ReevaluateCatalogRecordsDifferences = "ReevaluateCatalogRecordsDifferences",
}

enum TaskItemType {
    CatalogRecord = "CatalogRecord",
    Document = "Document",
}

enum TaskItemErrorType {
    ValueError = "ValueError",
    UnknownError = "UnknownError",
}

const DocumentsTasks = [
    TaskType.PredictPeriodicalsPageCount,
    TaskType.ReindexDocuments,
    TaskType.SyncDocumentsWithCatalogs,
    TaskType.SyncDocumentsWithDigitizationRegistry,
];
const CatalogRecordsTasks = [
    TaskType.ReindexCatalogRecords,
    TaskType.SyncCatalogRecordsWithCatalogs,
    TaskType.ReevaluateCatalogRecordsDifferences,
];
const DatasetTasks = [
    TaskType.GenerateVolumesPagesDataset,
    TaskType.GenerateItemsPagesDataset,
];
const ManagementTasks = [TaskType.RecreateIndexes];
const NoItemsTasks = [...DatasetTasks, ...ManagementTasks];

export {
    TaskType,
    TaskItemType,
    TaskItemErrorType,
    DocumentsTasks,
    CatalogRecordsTasks,
    DatasetTasks,
    ManagementTasks,
    NoItemsTasks,
};
