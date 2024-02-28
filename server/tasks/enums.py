from enum import Enum


class TaskType(Enum):
    PredictVolumePages = "PredictVolumePages"
    SyncFromCatalog = "SyncFromCatalog"
    SyncFromDigitizationRegistry = "SyncFromDigitizationRegistry"


class TaskState(Enum):
    Planned = "Planned"
    Running = "Running"
    Finished = "Finished"
    Failed = "Failed"
    Killed = "Killed"


class TaskDocumentErrorType(Enum):
    ValueError = "ValueError"
    UnknownError = "UnknownError"
