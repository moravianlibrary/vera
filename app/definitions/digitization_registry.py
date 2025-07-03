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


class DigitizationListState(Enum):
    """
    Enumeration representing the possible states of a digitization list.

    Attributes
    ----------
    Revision : str
        The digitization list is under revision.
    Planned : str
        The digitization list is planned but has not started.
    InProgress : str
        The digitization list is currently in progress.
    Finished : str
        The digitization list process is completed.
    """

    Revision = "Revision"
    Planned = "Planned"
    InProgress = "InProgress"
    Finished = "Finished"


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
