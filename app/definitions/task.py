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
    Process = "Process"
    Reindex = "Reindex"


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


TaskKind = (
    AdditionTask | DocumentTask | CatalogRecordTask | CategoryTask | SystemTask
)

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
