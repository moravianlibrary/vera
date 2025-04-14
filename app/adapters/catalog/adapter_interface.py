from abc import ABC, abstractmethod
from schemas import (
    CatalogGetResponse,
    CatalogSearchParams,
    CatalogSearchResponse,
)


class CatalogAdapterInterface(ABC):

    @abstractmethod
    def get_record(self, base: str, system_number: str) -> CatalogGetResponse:
        """
        Retrieve a catalog record based on the provided base and system number.
        """
        pass

    @abstractmethod
    def search(self, params: CatalogSearchParams) -> CatalogSearchResponse:
        """
        Search the catalog based on the given search parameters.
        """
        pass
