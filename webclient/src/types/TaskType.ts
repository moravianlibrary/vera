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

export { TaskType, TaskItemType, TaskItemErrorType };
