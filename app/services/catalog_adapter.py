from typing import List, Optional

from marcdantic.query import MarcSearchRequest
from vera_plugins.specs.catalog_adapter import (
    SearchResult,
    SearchResultResponse,
)

from adapters.catalog import CatalogAdapter
from definitions.identifier import IdentifierType
from repositories import CatalogRecordRepository


class CatalogSearchService:
    def __init__(
        self,
        catalog_adapter: CatalogAdapter,
        catalog_record_repository: CatalogRecordRepository,
    ):
        self._catalog_adapter = catalog_adapter
        self._catalog_record_repository = catalog_record_repository

    def search(self, request: MarcSearchRequest) -> SearchResultResponse:
        if self._catalog_adapter.instance.search:
            # TODO: Transform response to some pydantic
            return self._catalog_adapter.search(request)

        # TODO: Transform request to elasticsearch query
        return self._catalog_record_repository.search(request)

    def find_marc_record(
        self, identifier_type: IdentifierType, identifier_value: str
    ) -> Optional[List[SearchResult]]:
        if not self._catalog_adapter.instance.search:
            return None

        # TODO: Implement
        return self._catalog_adapter.search()
