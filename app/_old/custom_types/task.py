from enum import Enum


class TaskType(Enum):
    # Document Tasks
    Document_UpdateProperty = "Document_UpdateProperty"
    Document_Remove = "Document_Remove"
    Document_DeclineDigitization = "Document_DeclineDigitization"
    Document_CancelDigitizationDeclination = (
        "Document_CancelDigitizationDeclination"
    )
    Document_GenerateDigitizationList = "Document_GenerateDigitizationList"
    Document_Reindex = "Document_Reindex"
    Document_SyncDigitizationState = "Document_SyncDigitizationState"
    Document_SyncCatalogRecord = "Document_SyncCatalogRecord"
    Document_PredictPageCount = "Document_PredictPageCount"

    # Catalog Record Tasks
    CatalogRecord_IgnoreMissingAuthority = (
        "CatalogRecord_IgnoreMissingAuthority"
    )
    CatalogRecord_Reindex = "CatalogRecord_Reindex"
    CatalogRecord_Sync = "CatalogRecord_Sync"
    CatalogRecord_ReevaluateDifferences = "CatalogRecord_ReevaluateDifferences"
    CatalogRecord_ArchiveInactive = "CatalogRecord_ArchiveInactive"

    # Category Tasks
    Category_Reindex = "Category_Reindex"
    Category_ExecuteScript = "Category_ExecuteScript"

    # System Tasks
    System_RecreateIndex = "System_RecreateIndex"
    System_ResolveInconsistencies = "System_ResolveInconsistencies"
    System_GenerateBackup = "System_GenerateBackup"
    System_LoadFromBackup = "System_LoadFromBackup"


class TaskState(Enum):
    Initializing = "Initializing"
    Planned = "Planned"
    Running = "Running"
    Finished = "Finished"
    Failed = "Failed"
    Killed = "Killed"
