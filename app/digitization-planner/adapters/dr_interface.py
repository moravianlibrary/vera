from abc import ABC, abstractmethod
from schemas import DRAdapterResponse, MarcRecord, MarcIssue


class DRAdapterInterface(ABC):
    @abstractmethod
    def get_record(self, record_id: str) -> DRAdapterResponse:
        """
        Fetches a record by its ID.

        :param record_id: The ID of the record to fetch.
        :return: A DRAdapterResponse instance containing the response.
        """
        pass

    @abstractmethod
    def search(
        self, record: MarcRecord, issue: MarcIssue
    ) -> DRAdapterResponse:
        """
        Performs a search using a record and an issue.

        :param record: The record to search with.
        :param issue: The issue to search with.
        :return: A DRAdapterResponse instance containing the search response.
        """
        pass
