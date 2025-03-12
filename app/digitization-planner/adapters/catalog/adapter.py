from schemas import (
    CatalogAdapterConfig,
    CatalogSearchResponse,
    Record,
)
from .adapter_interface import CatalogAdapterInterface


class CatalogAdapter(CatalogAdapterInterface):
    def load_config(self, config: CatalogAdapterConfig) -> None:
        self.config = config

    def find_matching_authority_record(
        self, record: Record, authority_base: str
    ) -> CatalogSearchResponse:
        return CatalogSearchResponse(numFound=0, status="Success")
