from abc import abstractmethod
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Generator, List, NamedTuple

from marcdantic import MarcRecord

from vera_plugins.specs.catalog_adapter import (
    CatalogAdapterPlugin,
    ListRecordsResponse,
    NotImplementedException,
    RecordStatus,
    SearchResult,
    SearchResultResponse,
)


class CatalogAdapterPluginSkeleton(CatalogAdapterPlugin):
    """
    Abstract base class for catalog adapter plugins.

    At least one of the following method groups must be implemented:
    - Both `get_query_schema()` and `search()`
    - `fetch_changes()`

    Plugins should override the appropriate methods based on their use case.

    Methods
    -------
    is_available() -> bool
        Check whether the external resource is available.

    fetch:
        Fetch a specific record based on base and system number.

    fetch_changes:
        Fetch records modified since the given timestamp.

    get_query_schema:
        Return the expected schema for query parameters.

    search:
        Perform a paginated search (optional override).
    """

    def is_available(self) -> bool:
        """
        Check whether the external resource is available.

        Returns
        -------
        bool
            True if the resource is available, False otherwise.
        """
        return False

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
        return None

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

    def get_query_schema(self) -> Dict[str, Any]:
        """
        Return the query schema supported by this adapter.

        Returns
        -------
        Optional[Dict[str, Any]]
            Dictionary representing the query schema,
            or None if the adapter does not support querying.

        Raises
        ------
        NotImplementedException
            If querying is not supported by the plugin.
        """
        raise NotImplementedException(
            "get_query_schema not implemented in this plugin"
        )

    def search(
        self, query: Dict[str, Any], page: int, page_size: int
    ) -> SearchResultResponse:
        """
        Perform a search using given parameters.

        Parameters
        ----------
        query : Dict[str, Any]
            The query parameters.
        page : int
            Page number of the results.
        page_size : int
            Number of results per page.

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
