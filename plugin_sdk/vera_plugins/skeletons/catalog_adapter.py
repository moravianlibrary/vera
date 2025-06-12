from datetime import datetime
from typing import Generator

from marcdantic import MarcRecord
from marcdantic.query import MarcSearchRequest

from vera_plugins.specs.catalog_adapter import (
    CatalogAdapterPlugin,
    ListRecordsResponse,
    NotImplementedException,
    SearchResultResponse,
)


class Skeleton(CatalogAdapterPlugin):
    """
    Skeleton class for implementing catalog adapter plugins.

    At least one of the following methods must be implemented:
    - `fetch_changes()`
    - `search()`

    Plugins should override the appropriate methods based on their use case.

    Methods
    -------
    is_available() -> bool
        Check whether the external resource is available.

    fetch(base: str, system_number: str) -> MarcRecord | None:
        Fetch a specific record based on base and system number.

    fetch_changes(
        last_sync: datetime | None
    ) -> Generator[ListRecordsResponse, None, None]:
        Fetch records modified since the given timestamp.

    search(request: MarcSearchRequest) -> SearchResultResponse:
        Perform a paginated search.
    """

    def is_available(self) -> bool:
        """
        Check whether the external resource is available.

        Returns
        -------
        bool
            True if the resource is available, False otherwise.
        """
        raise NotImplementedError(
            "Implement the availability check logic here."
        )

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
        raise NotImplementedError("Implement the record fetching logic here.")

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
