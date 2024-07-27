from enum import Enum


class TaskType(Enum):
    PredictPeriodicalPageCount = "PredictPeriodicalPageCount"
    Reindex = "Reindex"
    SyncFromCatalogs = "SyncFromCatalogs"
    SyncFromDigitizationRegistry = "SyncFromDigitizationRegistry"
    GenerateVolumesPagesDataset = "GenerateVolumesPagesDataset"
    GenerateItemsPagesDataset = "GenerateItemsPagesDataset"


class TaskState(Enum):
    Planned = "Planned"
    Running = "Running"
    Finished = "Finished"
    Failed = "Failed"
    Killed = "Killed"


class TaskDocumentErrorType(Enum):
    ValueError = "ValueError"
    UnknownError = "UnknownError"
