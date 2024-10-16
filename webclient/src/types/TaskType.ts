enum TaskType {
    PredictPeriodicalsPageCount = "PredictPeriodicalsPageCount",
    ReindexDocuments = "ReindexDocuments",
    SyncDocumentsWithCatalogs = "SyncDocumentsWithCatalogs",
    SyncDocumentsWithDigitizationRegistry = "SyncDocumentsWithDigitizationRegistry",
    ReindexCatalogRecords = "ReindexCatalogRecords",
    SyncCatalogRecordsWithCatalogs = "SyncCatalogRecordsWithCatalogs",
    ReevaluateCatalogRecordsDifferences = "ReevaluateCatalogRecordsDifferences",
    GenerateVolumesPagesDataset = "GenerateVolumesPagesDataset",
    GenerateItemsPagesDataset = "GenerateItemsPagesDataset",
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

export {
    TaskType,
    TaskItemType,
    TaskItemErrorType,
    DocumentsTasks,
    CatalogRecordsTasks,
    DatasetTasks,
};
