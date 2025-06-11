from unittest import TestCase

from ..definitions import PluginType, patch_plugin
from ..specs.catalog_adapter import (
    CatalogAdapterPlugin,
    ListRecordsResponse,
    SearchResultResponse,
)


class TestCatalogAdapterPlugin(TestCase):
    @patch_plugin(PluginType.CatalogAdapter)
    def test_fetch(self, plugin: CatalogAdapterPlugin):
        plugin.fetch("BASE", "012345678")

    @patch_plugin(PluginType.CatalogAdapter)
    def test_fetch_changes(self, plugin: CatalogAdapterPlugin):
        try:
            response = next(plugin.fetch_changes())
            self.assertIsInstance(response, ListRecordsResponse)
        except NotImplementedError:
            self.skipTest("fetch_changes not implemented in this plugin")

    @patch_plugin(PluginType.CatalogAdapter)
    def test_get_query_schema(self, plugin: CatalogAdapterPlugin):
        try:
            schema = plugin.get_query_schema()
            self.assertIsInstance(schema, dict)
        except NotImplementedError:
            self.skipTest("get_query_schema not implemented in this plugin")

    @patch_plugin(PluginType.CatalogAdapter)
    def test_search(self, plugin: CatalogAdapterPlugin):
        try:
            response = plugin.search({}, page=1, page_size=10)
            self.assertIsInstance(response, SearchResultResponse)
        except NotImplementedError:
            self.skipTest("search not implemented in this plugin")

    @patch_plugin(PluginType.CatalogAdapter)
    def test_fetch_changes_or_search_implemented(
        self, plugin: CatalogAdapterPlugin
    ):
        try:
            response = next(plugin.fetch_changes())
            self.assertIsInstance(response, ListRecordsResponse)
            return
        except NotImplementedError:
            pass

        try:
            response = plugin.search({}, page=1, page_size=10)
            self.assertIsInstance(response, SearchResultResponse)
        except NotImplementedError:
            self.fail(
                "Neither fetch_changes nor search "
                "is implemented in this plugin"
            )
