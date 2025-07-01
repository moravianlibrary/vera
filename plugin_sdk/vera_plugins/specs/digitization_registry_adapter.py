from abc import abstractmethod
from enum import Enum
from typing import List, NamedTuple

from marcdantic import MarcIssue, MarcRecord

from .base import ExternalResourcePluginBase


class DigitizationRecordState(str, Enum):
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
    link : str | None
        An optional link to the digitization record in the registry,
        which can be used to access more details about the digitization.
    """

    registry_record_id: str
    record_state: List[DigitizationRecordState]
    registry_issue_id: str | None
    issue_state: DigitizationRecordState | None
    link: str | None = None


class DigitizationRegistryError(Exception):
    """
    Base exception for errors related to the digitization registry.

    This class serves as a base for more specific exceptions
    related to digitization registry operations.
    """

    def __init__(self, message: str):
        super().__init__(message)


class FetchError(DigitizationRegistryError):
    """
    Exception raised when fetching digitization records fails.

    Parameters
    ----------
    message : str
        The error message describing the failure.
    """

    def __init__(self, message: str):
        super().__init__(message)


class RegistrationError(DigitizationRegistryError):
    """
    Exception raised when a digitization record registration fails.

    Parameters
    ----------
    message : str
        The error message describing the failure.
    """

    def __init__(self, message: str):
        super().__init__(message)


class StateChangeError(DigitizationRegistryError):
    """
    Exception raised when a state change operation fails.

    Parameters
    ----------
    message : str
        The error message describing the failure.
    """

    def __init__(self, message: str):
        super().__init__(message)


class DigitizationRegistryAdapterPlugin(ExternalResourcePluginBase):
    """
    Abstract class for a plugin that interacts with a digitization registry.

    The methods `register_digitization` and `change_state` are optional.
    They are not used if the plugin is configured as read-only.

    Methods
    -------
    fetch(registry_issue_id: str) -> DigitizationRecord | None:
        Retrieve digitization information for a specific issue
        from the registry.

    find_for_marc_record(record: MarcRecord) -> List[DigitizationRecord] | None
        Find digitization records matching a given MARC record.

    find_for_marc_issue(
        record: MarcRecord, issue: MarcIssue
    ) -> List[DigitizationRecord] | None
        Find digitization records matching a given MARC record and issue.

    register_digitization(
        record: MarcRecord,
        issue: MarcIssue | None,
        state: DigitizationRecordState
    ) -> DigitizationRecord:
        Register a new digitization record in the registry.

    change_state(
        record_id: str, issue_id: str, state: DigitizationRecordState
    ) -> None:
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

        Raises
        ------
        FetchError
            If the fetch operation fails due to an error.
        """
        pass

    @abstractmethod
    def find_for_marc_record(
        self, record: MarcRecord
    ) -> List[DigitizationRecord] | None:
        """
        Find digitization records matching a given MARC record.

        Parameters
        ----------
        marc_record : MarcRecord
            The MARC record to search for digitization records.

        Returns
        -------
        list of DigitizationRecord or None
            A list of matching digitization records if found,
            otherwise None.

        Raises
        ------
        FetchError
            If the fetch operation fails due to an error.
        """
        pass

    @abstractmethod
    def find_for_marc_issue(
        self, record: MarcRecord, issue: MarcIssue
    ) -> List[DigitizationRecord] | None:
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
        list of DigitizationRecord or None
            A list of matching digitization records if found,
            otherwise None.

        Raises
        ------
        FetchError
            If the fetch operation fails due to an error.
        """
        pass

    def register_digitization(
        self,
        record: MarcRecord,
        issue: MarcIssue | None,
        state: DigitizationRecordState,
    ) -> DigitizationRecord:
        """
        Register a new digitization record in the registry.

        Parameters
        ----------
        record : MarcRecord
            The MARC record to register for digitization.

        issue : MarcIssue | None
            Optional issue within the MARC record to register.

        state : DigitizationRecordState
            Initial digitization state to assign.

        Returns
        -------
        DigitizationRecord
            The newly created digitization record.

        Raises
        ------
        RegistrationError
            If the registration fails due to an error.
        """
        raise NotImplementedError(
            "register_digitization not implemented in this plugin"
        )

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
        raise NotImplementedError(
            "change_state not implemented in this plugin"
        )
