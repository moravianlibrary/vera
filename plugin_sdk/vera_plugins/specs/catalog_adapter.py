from abc import abstractmethod
from datetime import datetime
from enum import Enum
from typing import Generator, List, NamedTuple

from marcdantic import MarcRecord
from marcdantic.query import MarcSearchRequest

from .base import ExternalResourcePluginBase


class RecordStatus(Enum):
    """
    Enumeration representing the possible statuses of a record.

    Attributes
    ----------
        Active: The record is currently active.
        Deleted: The record has been deleted.
        Failed: The record fetch operation has failed.
    """

    Active = "Active"
    Deleted = "Deleted"
    Failed = "Failed"


class ListRecordsResponse(NamedTuple):
    """
    Represents the response returned when fetching a list of records.

    Attributes
    ----------
        base (str):
            The base or catalog from which the record is fetched.
        system_number (str):
            The unique identifier of the record within the base.
        status (RecordStatus):
            The status of the record (e.g., Active, Deleted, Failed).
        error_message (str | None):
            If the status is Failed, this attribute contains
            an error message related to the record fetch.
            Otherwise, it is None.
        record (MarcRecord | None):
            The actual MARC record, or None if not available.
    """

    base: str
    system_number: str
    status: RecordStatus
    error_message: str | None = None
    record: MarcRecord | None = None


class SearchResult(NamedTuple):
    """
    Represents the result of a search operation.

    Attributes
    ----------
    base : str
        The base or catalog from which the record is fetched.
    system_number : str
        The unique identifier of the record within the base.
    record : MarcRecord
        The actual MARC record.
    """

    base: str
    system_number: str
    record: MarcRecord


class SearchResultResponse(NamedTuple):
    """
    Represents the response returned from a search operation with pagination.

    Attributes
    ----------
    records : List[SearchResult]
        A list of search results (records).
    num_found : int
        The total number of records that matched the search query.
    page : int
        The current page of results.
    page_size : int
        The number of results per page.
    """

    records: List[SearchResult]
    num_found: int
    page: int
    page_size: int


class NotImplementedException(Exception):
    def __init__(self, message: str):
        super().__init__(message)


class CatalogAdapterPlugin(ExternalResourcePluginBase):
    """
    Abstract base class for catalog adapter plugins.

    At least one of the following methods must be implemented:
    - `fetch_changes()`
    - `search()`

    Plugins should override the appropriate methods based on their use case.

    Methods
    -------
    fetch(base: str, system_number: str) -> MarcRecord | None:
        Fetch a specific record based on base and system number.

    fetch_changes(
        last_sync: datetime | None
    ) -> Generator[ListRecordsResponse, None, None]:
        Fetch records modified since the given timestamp.

    search(request: MarcSearchRequest) -> SearchResultResponse:
        Perform a paginated search.
    """

    @abstractmethod
    def fetch(self, base: str, system_number: str) -> MarcRecord | None:
        """
        Fetch a MARC record based on the base and system number.

        Parameters
        ----------
        base : str
            The base or catalog from which to fetch the record.
        system_number : str
            The unique identifier for the record.

        Returns
        -------
        Optional[MarcRecord]
            The fetched MARC record, or None if the record is not found.
        """
        pass

    def fetch_changes(
        self, last_sync: datetime | None
    ) -> Generator[ListRecordsResponse, None, None]:
        """
        Fetch records that have been changed since the last synchronization.

        Parameters
        ----------
        last_sync : datetime or None
            If provided, fetch only records changed after this timestamp.
            If None, fetch all available records.

        Yields
        ------
        ListRecordResponse
            Changed record information.

        Raises
        ------
        NotImplementedException
            If change fetching is not supported by the plugin.
        """
        raise NotImplementedException(
            "fetch_changes not implemented in this plugin"
        )

    def search(self, request: MarcSearchRequest) -> SearchResultResponse:
        """
        Perform a search using given parameters.

        Parameters
        ----------
        request : MarcSearchRequest
            The search request containing the query and pagination parameters.

        Returns
        -------
        SearchResultResponse
            An object containing the matched records and pagination metadata.

        Raises
        ------
        NotImplementedException
            If search is not supported by the plugin.
        """
        raise NotImplementedException("search not implemented in this plugin")
