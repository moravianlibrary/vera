from abc import abstractmethod
from datetime import datetime
from enum import Enum
from typing import Generator, NamedTuple

from marcdantic import MarcRecord

from .base import BaseResourcePlugin


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


class ListRecordResponse(NamedTuple):
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


class CatalogAdapterPlugin(BaseResourcePlugin):
    """
    Abstract interface for catalog adapter plugins. Defines the methods
    that a catalog adapter plugin must implement for interacting with
    bibliographic records.

    Methods
    -------
    fetch:
        Fetch a specific record based on base and system number.
    fetch_additions:
        Fetch a list of additions since the last synchronization.
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
            The fetched MARC record, or None if not found.
        """
        pass

    @abstractmethod
    def fetch_additions(
        self, last_sync: datetime | None
    ) -> Generator[ListRecordResponse, None, None]:
        """
        Fetch records that have been added since the last synchronization.

        Parameters
        ----------
        last_sync : datetime | None
            The timestamp of the last synchronization.
            If None, fetch all records.

        Returns
        -------
        Generator[ListRecordResponse, None, None]
            A generator that yields responses containing record details such as
            the base, system number, status, and the actual record.
        """
        pass
