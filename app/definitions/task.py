from dataclasses import dataclass
from enum import Enum


class TaskState(str, Enum):
    Initializing = "Initializing"
    Planned = "Planned"
    Running = "Running"
    Finished = "Finished"
    Failed = "Failed"
    Killed = "Killed"
    Canceled = "Canceled"


class AdditionTask(str, Enum):
    Ingest = "Ingest"
    IgnoreDigitizationCheck = "IgnoreDigitizationCheck"
    AllowNewIteration = "AllowNewIteration"
    Archive = "Archive"
    Delete = "Delete"


class DocumentTask(str, Enum):
    Reindex = "Reindex"
    UpdateProperty = "UpdateProperty"
    Remove = "Remove"
    SyncDigitizationState = "SyncDigitizationState"
    SyncCatalogRecord = "SyncCatalogRecord"
    SyncProperty = "SyncProperty"
    DeclineDigitization = "DeclineDigitization"
    CancelDigitizationDeclination = "CancelDigitizationDeclination"
    GenerateDigitizationList = "GenerateDigitizationList"


class CatalogRecordTask(str, Enum):
    Reindex = "Reindex"
    Sync = "Sync"
    SetValid = "SetValid"
    SetInvalid = "SetInvalid"
    ArchiveInactive = "ArchiveInactive"


class CategoryTask(str, Enum):
    Reindex = "Reindex"
    ExecuteScript = "ExecuteScript"


class SystemTask(str, Enum):
    RecreateIndex = "RecreateIndex"
    ResolveInconsistencies = "ResolveInconsistencies"


class TaskScope(str, Enum):
    Addition = "Addition"
    Document = "Document"
    CatalogRecord = "CatalogRecord"
    Category = "Category"
    System = "System"


TaskType = (
    AdditionTask | DocumentTask | CatalogRecordTask | CategoryTask | SystemTask
)


class ScopedTaskType(str, Enum):
    # Addition
    Addition_Ingest = "Addition.Ingest"
    Addition_IgnoreDigitizationCheck = "Addition.IgnoreDigitizationCheck"
    Addition_AllowNewIteration = "Addition.AllowNewIteration"
    Addition_Archive = "Addition.Archive"
    Addition_Delete = "Addition.Delete"

    # Document
    Document_Reindex = "Document.Reindex"
    Document_UpdateProperty = "Document.UpdateProperty"
    Document_Remove = "Document.Remove"
    Document_SyncDigitizationState = "Document.SyncDigitizationState"
    Document_SyncCatalogRecord = "Document.SyncCatalogRecord"
    Document_SyncProperty = "Document.SyncProperty"
    Document_DeclineDigitization = "Document.DeclineDigitization"
    Document_CancelDigitizationDeclination = (
        "Document.CancelDigitizationDeclination"
    )
    Document_GenerateDigitizationList = "Document.GenerateDigitizationList"

    # CatalogRecord
    CatalogRecord_Reindex = "CatalogRecord.Reindex"
    CatalogRecord_Sync = "CatalogRecord.Sync"
    CatalogRecord_SetValid = "CatalogRecord.SetValid"
    CatalogRecord_SetInvalid = "CatalogRecord.SetInvalid"
    CatalogRecord_ArchiveInactive = "CatalogRecord.ArchiveInactive"

    # Category
    Category_Reindex = "Category.Reindex"
    Category_ExecuteScript = "Category.ExecuteScript"

    # System
    System_RecreateIndex = "System.RecreateIndex"
    System_ResolveInconsistencies = "System.ResolveInconsistencies"


unlimited = -1


@dataclass(frozen=True)
class TaskMetadata:
    visible: bool = True
    schedulable: bool = True
    max_running: int = unlimited
    max_planned: int = unlimited
    blocking: bool = False


MANUAL_ONLY_TASKS = [
    AdditionTask.Process,
    AdditionTask.Reindex,
    DocumentTask.UpdateProperty,
    DocumentTask.Remove,
    DocumentTask.DeclineDigitization,
    DocumentTask.CancelDigitizationDeclination,
    DocumentTask.GenerateDigitizationList,
    CatalogRecordTask.SetValid,
    CatalogRecordTask.SetInvalid,
]

HIDDEN_TASKS = [
    AdditionTask.Process,
    AdditionTask.Reindex,
    DocumentTask.DeclineDigitization,
    DocumentTask.CancelDigitizationDeclination,
    DocumentTask.GenerateDigitizationList,
    CatalogRecordTask.SetValid,
    CatalogRecordTask.SetInvalid,
]

MAX_ONE_AT_A_TIME_TASKS = [
    SystemTask.RecreateIndex,
    SystemTask.ResolveInconsistencies,
]

TASK_METADATA_REGISTRY = {
    AdditionTask.Process: TaskMetadata(
        visible=False,
        schedulable=False,
    ),
    AdditionTask.Reindex: TaskMetadata(
        visible=False,
        schedulable=False,
    ),
    DocumentTask.Reindex: TaskMetadata(),
    DocumentTask.UpdateProperty: TaskMetadata(schedulable=False),
    DocumentTask.Remove: TaskMetadata(schedulable=False),
    DocumentTask.SyncDigitizationState: TaskMetadata(),
    DocumentTask.SyncCatalogRecord: TaskMetadata(),
    DocumentTask.SyncProperty: TaskMetadata(),
    DocumentTask.DeclineDigitization: TaskMetadata(schedulable=False),
    DocumentTask.CancelDigitizationDeclination: TaskMetadata(
        schedulable=False
    ),
    DocumentTask.GenerateDigitizationList: TaskMetadata(schedulable=False),
    CatalogRecordTask.Reindex: TaskMetadata(),
    CatalogRecordTask.Sync: TaskMetadata(),
    CatalogRecordTask.SetValid: TaskMetadata(schedulable=False),
    CatalogRecordTask.SetInvalid: TaskMetadata(schedulable=False),
    CatalogRecordTask.ArchiveInactive: TaskMetadata(),
    CategoryTask.Reindex: TaskMetadata(),
    CategoryTask.ExecuteScript: TaskMetadata(),
    SystemTask.RecreateIndex: TaskMetadata(blocking=True),
    SystemTask.ResolveInconsistencies: TaskMetadata(),
}
