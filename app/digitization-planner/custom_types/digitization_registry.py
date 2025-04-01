from enum import Enum


class DigitizationState(Enum):
    """
    Enumeration representing the possible states of digitization.

    Attributes
    ----------
    Finished : str
        The digitization process is completed.
    InProgress : str
        The digitization process is currently in progress.
    Planned : str
        The digitization process is planned but has not started.
    Revision : str
        The digitized content is under revision.
    Unknown : str
        The state of digitization is unknown.
    Ambiguous : str
        The digitization state is unclear or conflicting.
    NotAvailable : str
        The digitization record is no longer available.
    NotDigitized : str
        The resource has not been digitized.
    """

    Finished = "Finished"
    InProgress = "InProgress"
    Planned = "Planned"
    Revision = "Revision"
    Unknown = "Unknown"
    Ambiguous = "Ambiguous"
    NotAvailable = "NotAvailable"
    NotDigitized = "NotDigitized"


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
