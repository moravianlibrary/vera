from enum import Enum


class DRFetchStatus(Enum):
    Unavailable = "Unavailable"
    RequestFailed = "RequestFailed"
    Success = "Success"


class DRState(Enum):
    Finished = "Finished"
    InProgress = "InProgress"
    Planned = "Planned"
    NotDigitized = "NotDigitized"
    Revision = "Revision"
    Unknown = "Unknown"
