from datetime import datetime
from typing import Generator

from marcdantic import MarcRecord
from marcdantic.query import MarcSearchRequest
from vera_plugins.specs.catalog_adapter import (
    CatalogAdapterPlugin,
    ListRecordsResponse,
    SearchResultResponse,
)
from vera_plugins.tools.registry import PluginRegistry


class CatalogAdapter(CatalogAdapterPlugin):
    def __init__(self, plugin_registry: PluginRegistry):
        instance = plugin_registry.catalog_adapter
        self._plugin = instance.plugin
        self._config = instance.config

    def fetch(self, base: str, system_number: str) -> MarcRecord | None:
        return self._plugin.fetch(base, system_number)

    def fetch_changes(
        self, last_sync: datetime | None
    ) -> Generator[ListRecordsResponse, None, None]:
        if not self._config.fetch_changes:
            raise NotImplementedError(
                "Used catalog adapter does not support fetching changes."
            )
        yield from self._plugin.fetch_changes(last_sync)

    def search(self, request: MarcSearchRequest) -> SearchResultResponse:
        if not self._config.search:
            raise NotImplementedError(
                "Used catalog adapter does not support searching."
            )
        return self._plugin.search(request)
