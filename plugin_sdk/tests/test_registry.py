import unittest
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch

from vera_plugins.definitions.plugin_types import PluginType
from vera_plugins.schemas import (
    CatalogAdapterConfig,
    CatalogRecordPropertyConfig,
    DigitizationRegistryConfig,
    DocumentDiscoveryConfig,
    IdentityProviderConfig,
    PluginMeta,
)
from vera_plugins.tools.registry import PluginRegistry


class TestPluginRegistry(unittest.TestCase):

    def setUp(self):
        self.registry = PluginRegistry()

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_register_singleton_plugin(self, mock_load_plugin_class: Mock):
        mock_load_plugin_class.return_value = MagicMock()

        meta = PluginMeta(
            type=PluginType.CatalogAdapter,
            name="TestPlugin",
            entrypoint_file="test.py",
        )
        instance = CatalogAdapterConfig(
            plugin_name="TestPlugin", instance_name="TestInstance"
        )

        self.registry.register_from_path(meta, Path("/fake/path"), instance)

        # Check if the plugin is registered
        self.assertIn(
            PluginType.CatalogAdapter, self.registry._singleton_plugins
        )
        self.assertIsInstance(
            self.registry._singleton_plugins[PluginType.CatalogAdapter], tuple
        )

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_raise_if_registering_multiple_singleton_plugins(
        self, mock_load_plugin_class: Mock
    ):
        mock_load_plugin_class.return_value = MagicMock()
        meta1 = PluginMeta(
            type=PluginType.CatalogAdapter,
            name="TestPlugin1",
            entrypoint_file="test1.py",
        )
        instance1 = CatalogAdapterConfig(
            plugin_name="TestPlugin1", instance_name="Instance1"
        )

        meta2 = PluginMeta(
            type=PluginType.CatalogAdapter,
            name="TestPlugin2",
            entrypoint_file="test2.py",
        )
        instance2 = CatalogAdapterConfig(
            plugin_name="TestPlugin2", instance_name="Instance2"
        )

        self.registry.register_from_path(meta1, Path("/fake/path1"), instance1)

        with self.assertRaises(ValueError) as context:
            self.registry.register_from_path(
                meta2, Path("/fake/path2"), instance2
            )

        self.assertEqual(
            str(context.exception),
            "Plugin of type 'CatalogAdapter' is already registered.",
        )
        self.assertIn(
            PluginType.CatalogAdapter, self.registry._singleton_plugins
        )
        self.assertIsInstance(
            self.registry._singleton_plugins[PluginType.CatalogAdapter], tuple
        )
        self.assertEqual(
            "Instance1",
            self.registry._singleton_plugins[PluginType.CatalogAdapter][
                1
            ].instance_name,
        )

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_raise_if_registering_multiple_same_name_plugins(
        self, mock_load_plugin_class: Mock
    ):
        mock_load_plugin_class.return_value = MagicMock()

        meta = PluginMeta(
            type=PluginType.CatalogRecordProperty,
            name="TestPlugin1",
            entrypoint_file="test1.py",
        )

        instance1 = CatalogRecordPropertyConfig(
            plugin_name="TestPlugin1",
            instance_name="Instance",
            property_name="Property",
            property_type={"type": "string"},
        )
        instance2 = CatalogRecordPropertyConfig(
            plugin_name="TestPlugin2",
            instance_name="Instance",
            property_name="Property",
            property_type={"type": "string"},
        )

        self.registry.register_from_path(
            meta, Path("/fake/path1"), instance1, 1
        )

        with self.assertRaises(ValueError) as context:
            self.registry.register_from_path(
                meta, Path("/fake/path2"), instance2
            )

        self.assertEqual(
            str(context.exception),
            "Plugin 'TestPlugin1' of type "
            "'CatalogRecordProperty' is already registered.",
        )
        self.assertIn(
            PluginType.CatalogRecordProperty, self.registry._multi_plugins
        )
        self.assertIsInstance(
            self.registry._multi_plugins[PluginType.CatalogRecordProperty],
            dict,
        )
        self.assertEqual(
            "Instance",
            self.registry._multi_plugins[PluginType.CatalogRecordProperty][1][
                1
            ].instance_name,
        )

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_load_catalog_adapter(self, mock_load_plugin_class: Mock):
        mock_load_plugin_class.return_value = MagicMock()

        meta = PluginMeta(
            type=PluginType.CatalogAdapter,
            name="TestPlugin",
            entrypoint_file="test.py",
        )
        instance = CatalogAdapterConfig(
            plugin_name="TestPlugin", instance_name="Instance"
        )

        self.registry.register_from_path(meta, Path("/fake/path"), instance)

        plugin = self.registry.catalog_adapter
        self.assertIsNotNone(plugin)

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_load_digitization_registry_adapter(
        self, mock_load_plugin_class: Mock
    ):
        mock_load_plugin_class.return_value = MagicMock()

        meta = PluginMeta(
            type=PluginType.DigitizationRegistryAdapter,
            name="TestPlugin",
            entrypoint_file="test.py",
        )
        instance = DigitizationRegistryConfig(
            plugin_name="TestPlugin", instance_name="Instance"
        )

        self.registry.register_from_path(meta, Path("/fake/path"), instance)

        plugin = self.registry.digitization_registry_adapter
        self.assertIsNotNone(plugin)

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_load_multi_plugin(self, mock_load_plugin_class: Mock):
        mock_load_plugin_class.return_value = MagicMock()

        meta = PluginMeta(
            type=PluginType.CatalogRecordProperty,
            name="TestPlugin",
            entrypoint_file="test.py",
        )
        instance = CatalogRecordPropertyConfig(
            plugin_name="TestPlugin",
            instance_name="Instance",
            property_name="Property",
            property_type={"type": "string"},
        )

        self.registry.register_from_path(meta, Path("/fake/path"), instance, 1)

        plugin = self.registry._load_multi_plugin(
            PluginType.CatalogRecordProperty, 1
        )
        self.assertIsNotNone(plugin)

    def test_load_multi_plugin_type_not_found(self):
        with self.assertRaises(ValueError) as context:
            self.registry._load_multi_plugin(
                PluginType.CatalogRecordProperty, 1
            )
        self.assertEqual(
            str(context.exception),
            "No plugin registered for type 'CatalogRecordProperty' "
            "with instance ID 1.",
        )

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_load_multi_plugin_not_found(self, mock_load_plugin_class: Mock):
        mock_load_plugin_class.return_value = MagicMock()

        meta = PluginMeta(
            type=PluginType.CatalogRecordProperty,
            name="TestPlugin",
            entrypoint_file="test.py",
        )

        instance = CatalogRecordPropertyConfig(
            plugin_name="TestPlugin",
            instance_name="Instance",
            property_name="Property",
            property_type={"type": "string"},
        )

        self.registry.register_from_path(
            meta, Path("/fake/path1"), instance, 1
        )

        with self.assertRaises(ValueError) as context:
            self.registry._load_multi_plugin(
                PluginType.CatalogRecordProperty, 2
            )
        self.assertEqual(
            str(context.exception),
            "No plugin registered for type 'CatalogRecordProperty' "
            "with instance ID 2.",
        )

    def test_load_singleton_plugin_not_found(self):
        with self.assertRaises(ValueError) as context:
            self.registry._load_singleton_plugin(PluginType.CatalogAdapter)
        self.assertEqual(
            str(context.exception),
            "No plugin registered for type 'CatalogAdapter'.",
        )

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_register_multi_plugin_without_instance_id(
        self, mock_load_plugin_class: Mock
    ):
        mock_load_plugin_class.return_value = MagicMock()

        meta = PluginMeta(
            type=PluginType.CatalogRecordProperty,
            name="TestPlugin",
            entrypoint_file="test.py",
        )
        instance = CatalogRecordPropertyConfig(
            plugin_name="TestPlugin",
            instance_name="Instance",
            property_name="Property",
            property_type={"type": "string"},
        )

        with self.assertRaises(ValueError) as context:
            self.registry.register_from_path(
                meta, Path("/fake/path"), instance
            )

        self.assertEqual(
            str(context.exception),
            "Instance ID must be provided for multi-instance plugins.",
        )

    @patch("vera_plugins.tools.registry.unpack_plugin")
    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_register_packaged_plugin(
        self, mock_load_plugin_class: Mock, mock_unpack: Mock
    ):
        mock_load_plugin_class.return_value = MagicMock()
        mock_unpack.return_value = Path("/fake/unpacked/path")

        meta = PluginMeta(
            type=PluginType.CatalogAdapter,
            name="PackagedPlugin",
            entrypoint_file="packaged.py",
        )
        instance = CatalogAdapterConfig(
            plugin_name="PackagedPlugin", instance_name="PackagedInstance"
        )

        self.registry.register(meta, b"fake_package_data", instance)

        self.assertIn(
            PluginType.CatalogAdapter, self.registry._singleton_plugins
        )
        self.assertIsInstance(
            self.registry._singleton_plugins[PluginType.CatalogAdapter], tuple
        )
        self.assertEqual(
            "PackagedInstance",
            self.registry._singleton_plugins[PluginType.CatalogAdapter][
                1
            ].instance_name,
        )

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_load_identity_provider(self, mock_load_plugin_class: Mock):
        mock_load_plugin_class.return_value = MagicMock()

        meta = PluginMeta(
            type=PluginType.IdentityProvider,
            name="TestPlugin",
            entrypoint_file="test.py",
        )
        instance = IdentityProviderConfig(
            plugin_name="TestPlugin",
            instance_name="Instance",
        )

        self.registry.register_from_path(meta, Path("/fake/path"), instance, 1)

        plugin = self.registry.identity_provider
        self.assertIsNotNone(plugin)

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_load_catalog_record_validity(self, mock_load_plugin_class: Mock):
        mock_load_plugin_class.return_value = MagicMock()

        meta = PluginMeta(
            type=PluginType.CatalogRecordValidity,
            name="TestPlugin",
            entrypoint_file="test.py",
        )
        instance = CatalogRecordPropertyConfig(
            plugin_name="TestPlugin",
            instance_name="Instance",
            property_name="Property",
            property_type={"type": "string"},
        )

        self.registry.register_from_path(meta, Path("/fake/path"), instance, 1)

        plugin = self.registry.catalog_record_validity(1)
        self.assertIsNotNone(plugin)

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_load_catalog_record_property(self, mock_load_plugin_class: Mock):
        mock_load_plugin_class.return_value = MagicMock()

        meta = PluginMeta(
            type=PluginType.CatalogRecordProperty,
            name="TestPlugin",
            entrypoint_file="test.py",
        )
        instance = CatalogRecordPropertyConfig(
            plugin_name="TestPlugin",
            instance_name="Instance",
            property_name="Property",
            property_type={"type": "string"},
        )

        self.registry.register_from_path(meta, Path("/fake/path"), instance, 1)

        plugin = self.registry.catalog_record_property(1)
        self.assertIsNotNone(plugin)

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_load_document_page_count(self, mock_load_plugin_class: Mock):
        mock_load_plugin_class.return_value = MagicMock()

        meta = PluginMeta(
            type=PluginType.DocumentPageCount,
            name="TestPlugin",
            entrypoint_file="test.py",
        )
        instance = DocumentDiscoveryConfig(
            plugin_name="TestPlugin",
            instance_name="Instance",
            property_name="Property",
            property_type={"type": "string"},
        )

        self.registry.register_from_path(meta, Path("/fake/path"), instance, 1)

        plugin = self.registry.document_page_count(1)
        self.assertIsNotNone(plugin)

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_load_document_can_be_extracted(
        self, mock_load_plugin_class: Mock
    ):
        mock_load_plugin_class.return_value = MagicMock()

        meta = PluginMeta(
            type=PluginType.DocumentCanBeExtracted,
            name="TestPlugin",
            entrypoint_file="test.py",
        )
        instance = DocumentDiscoveryConfig(
            plugin_name="TestPlugin",
            instance_name="Instance",
            property_name="Property",
            property_type={"type": "string"},
        )

        self.registry.register_from_path(meta, Path("/fake/path"), instance, 1)

        plugin = self.registry.document_can_be_extracted(1)
        self.assertIsNotNone(plugin)

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_load_document_property(self, mock_load_plugin_class: Mock):
        mock_load_plugin_class.return_value = MagicMock()

        meta = PluginMeta(
            type=PluginType.DocumentProperty,
            name="TestPlugin",
            entrypoint_file="test.py",
        )
        instance = DocumentDiscoveryConfig(
            plugin_name="TestPlugin",
            instance_name="Instance",
            property_name="Property",
            property_type={"type": "string"},
        )

        self.registry.register_from_path(meta, Path("/fake/path"), instance, 1)

        plugin = self.registry.document_property(1)
        self.assertIsNotNone(plugin)

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_load_document_discovery(self, mock_load_plugin_class: Mock):
        mock_load_plugin_class.return_value = MagicMock()

        meta = PluginMeta(
            type=PluginType.DocumentDiscovery,
            name="TestPlugin",
            entrypoint_file="test.py",
        )
        instance = DocumentDiscoveryConfig(
            plugin_name="TestPlugin",
            instance_name="Instance",
        )

        self.registry.register_from_path(meta, Path("/fake/path"), instance, 1)

        plugin = self.registry.document_discovery(1)
        self.assertIsNotNone(plugin)

    @patch("vera_plugins.tools.registry.PluginRegistry._load_plugin")
    def test_load_singleton_plugin_from_cache(self, mock_load_plugin: Mock):
        mock_plugin_instance = MagicMock()
        mock_load_plugin.return_value = mock_plugin_instance

        registry = PluginRegistry()

        plugin_type = PluginType.CatalogAdapter
        registry._singleton_plugins[plugin_type] = (MagicMock(), MagicMock())

        result1 = registry._singleton_plugins_cache(plugin_type)
        result2 = registry._singleton_plugins_cache(plugin_type)

        mock_load_plugin.assert_called_once()

        self.assertIs(result1, result2)

    @patch("vera_plugins.tools.registry.PluginRegistry._load_plugin")
    def test_clear_plugin_cache_resets_cache(self, mock_load_plugin: Mock):
        mock_plugin_instance = MagicMock()
        mock_load_plugin.return_value = mock_plugin_instance

        registry = PluginRegistry()

        plugin_type = PluginType.CatalogAdapter
        registry._singleton_plugins[plugin_type] = (MagicMock(), MagicMock())

        registry._singleton_plugins_cache(plugin_type)
        registry._singleton_plugins_cache(plugin_type)
        mock_load_plugin.assert_called_once()

        registry.clear_plugin_cache()

        registry._singleton_plugins_cache(plugin_type)
        registry._singleton_plugins_cache(plugin_type)

        self.assertEqual(mock_load_plugin.call_count, 2)
