from abc import abstractmethod
from enum import Enum
from typing import List, NamedTuple, Tuple

from marcdantic import MarcIssue, MarcRecord

from .base import BaseResourcePlugin


class DigitizationRecordState(Enum):
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
    """

    Finished = "Finished"
    InProgress = "InProgress"
    Planned = "Planned"
    Revision = "Revision"
    Unknown = "Unknown"


class DigitizationRecord(NamedTuple):
    """
    A record representing the digitization status of a catalog record
    or catalog record issue.

    Attributes
    ----------
    registry_record_id : str
        The ID of the record in the digitization registry,
        corresponding to a catalog record.
    record_state : List[DigitizationRecordState]
        The states associated with the catalog record
        in the digitization registry.
    registry_issue_id : str | None
        The ID of a specific issue within the registry,
        or None if not found.
    issue_state : DigitizationRecordState | None
        The state of the specific issue within the digitization registry,
        or None if not found.
    error_message : str | None, optional
        An optional error message if the record retrieval
        or processing encountered an issue.
    """

    registry_record_id: str
    record_state: List[DigitizationRecordState]
    registry_issue_id: str | None
    issue_state: DigitizationRecordState | None
    error_message: str | None = None


Score = float

FindResponse = List[Tuple[DigitizationRecord, Score]]


class StateChangeError(Exception):
    """
    Exception raised when a state change operation fails.

    Parameters
    ----------
    message : str
        The error message describing the failure.
    """

    def __init__(self, message: str):
        super().__init__(message)


class DigitizationRegistryAdapterPlugin(BaseResourcePlugin):
    """
    Abstract class for a plugin that interacts with a digitization registry.

    Methods
    -------
    fetch:
        Retrieve digitization information for a specific issue
        from the registry.
    find_for_marc_record:
        Find digitization records matching a given MARC record.
    find_for_marc_issue:
        Find digitization records matching a given MARC record and issue.
    change_state:
        Change the digitization state of a specific record and issue.
    """

    @abstractmethod
    def fetch(self, registry_issue_id: str) -> DigitizationRecord | None:
        """
        Retrieve digitization information
        for a specific issue from the registry.

        Parameters
        ----------
        registry_issue_id : str
            The unique identifier of the issue in the digitization registry.

        Returns
        -------
        DigitizationRecord | None
            The digitization record if found, otherwise None.
        """
        pass

    @abstractmethod
    def find_for_marc_record(self, marc_record: MarcRecord) -> FindResponse:
        """
        Find digitization records matching a given MARC record.

        Parameters
        ----------
        marc_record : MarcRecord
            The MARC record to search for digitization records.

        Returns
        -------
        FindResponse
            A list of tuples containing digitization records
            and their relevance scores.
        """
        pass

    @abstractmethod
    def find_for_marc_issue(
        self, record: MarcRecord, issue: MarcIssue
    ) -> FindResponse:
        """
        Find digitization records matching a given MARC record and issue.

        Parameters
        ----------
        record : MarcRecord
            The MARC record associated with the issue.
        issue : MarcIssue
            The specific MARC issue to search for digitization records.

        Returns
        -------
        FindResponse
            A list of tuples containing digitization records
            and their relevance scores.
        """
        pass

    @abstractmethod
    def change_state(
        self, record_id: str, issue_id: str, state: DigitizationRecordState
    ) -> None:
        """
        Change the digitization state of a specific record and issue.

        Parameters
        ----------
        record_id : str
            The unique identifier of the record in the digitization registry.
        issue_id : str
            The unique identifier of the issue in the digitization registry.
        state : DigitizationRecordState
            The new state to assign to the digitization record.

        Raises
        ------
        StateChangeError
            If the state change operation fails.
        """
        pass
