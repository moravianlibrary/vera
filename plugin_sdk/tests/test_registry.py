import unittest
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch

from vera_plugins.definitions.plugin_types import PluginType
from vera_plugins.schemas import (
    CatalogAdapterPluginInstance,
    CatalogPropertyPluginInstance,
    DigitizationRegistryPluginInstance,
    DocumentDiscoveryPluginInstance,
    IdentityProviderPluginInstance,
    PluginMeta,
)
from vera_plugins.tools.registry import PluginRegistry


class TestPluginRegistry(unittest.TestCase):

    def setUp(self):
        self.registry = PluginRegistry()

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_register_single_plugin(self, mock_load_plugin_class: Mock):
        mock_load_plugin_class.return_value = MagicMock()

        meta = PluginMeta(
            type=PluginType.CatalogAdapter,
            name="TestPlugin",
            entrypoint_file="test.py",
        )
        instance = CatalogAdapterPluginInstance(
            plugin_name="TestPlugin", instance_name="TestInstance"
        )

        self.registry.register_from_path(meta, Path("/fake/path"), instance)

        # Check if the plugin is registered
        self.assertIn(PluginType.CatalogAdapter, self.registry._registry)
        self.assertIsInstance(
            self.registry._registry[PluginType.CatalogAdapter], tuple
        )

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_raise_if_registering_multiple_single_plugins(
        self, mock_load_plugin_class: Mock
    ):
        mock_load_plugin_class.return_value = MagicMock()
        meta1 = PluginMeta(
            type=PluginType.CatalogAdapter,
            name="TestPlugin1",
            entrypoint_file="test1.py",
        )
        instance1 = CatalogAdapterPluginInstance(
            plugin_name="TestPlugin1", instance_name="Instance1"
        )

        meta2 = PluginMeta(
            type=PluginType.CatalogAdapter,
            name="TestPlugin2",
            entrypoint_file="test2.py",
        )
        instance2 = CatalogAdapterPluginInstance(
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
        self.assertIn(PluginType.CatalogAdapter, self.registry._registry)
        self.assertIsInstance(
            self.registry._registry[PluginType.CatalogAdapter], tuple
        )
        self.assertEqual(
            "Instance1",
            self.registry._registry[PluginType.CatalogAdapter][
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

        instance1 = CatalogPropertyPluginInstance(
            plugin_name="TestPlugin1",
            instance_name="Instance",
            property_name="Property",
            property_type={"type": "string"},
        )
        instance2 = CatalogPropertyPluginInstance(
            plugin_name="TestPlugin2",
            instance_name="Instance",
            property_name="Property",
            property_type={"type": "string"},
        )

        self.registry.register_from_path(meta, Path("/fake/path1"), instance1)

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
            PluginType.CatalogRecordProperty, self.registry._registry
        )
        self.assertIsInstance(
            self.registry._registry[PluginType.CatalogRecordProperty], dict
        )
        self.assertEqual(
            "Instance",
            self.registry._registry[PluginType.CatalogRecordProperty][
                "TestPlugin1"
            ][1].instance_name,
        )

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_load_catalog_adapter(self, mock_load_plugin_class: Mock):
        mock_load_plugin_class.return_value = MagicMock()

        meta = PluginMeta(
            type=PluginType.CatalogAdapter,
            name="TestPlugin",
            entrypoint_file="test.py",
        )
        instance = CatalogAdapterPluginInstance(
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
        instance = DigitizationRegistryPluginInstance(
            plugin_name="TestPlugin", instance_name="Instance"
        )

        self.registry.register_from_path(meta, Path("/fake/path"), instance)

        plugin = self.registry.digitization_registry_adapter
        self.assertIsNotNone(plugin)

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_load_named_plugin(self, mock_load_plugin_class: Mock):
        mock_load_plugin_class.return_value = MagicMock()

        meta = PluginMeta(
            type=PluginType.CatalogRecordProperty,
            name="TestPlugin",
            entrypoint_file="test.py",
        )
        instance = CatalogPropertyPluginInstance(
            plugin_name="TestPlugin",
            instance_name="Instance",
            property_name="Property",
            property_type={"type": "string"},
        )

        self.registry.register_from_path(meta, Path("/fake/path"), instance)

        plugin = self.registry._load_named_plugin(
            PluginType.CatalogRecordProperty, "TestPlugin"
        )
        self.assertIsNotNone(plugin)

    def test_load_named_plugin_type_not_found(self):
        with self.assertRaises(ValueError) as context:
            self.registry._load_named_plugin(
                PluginType.CatalogRecordProperty, "NonExistentPlugin"
            )
        self.assertEqual(
            str(context.exception),
            "No plugins registered for type 'CatalogRecordProperty'.",
        )

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_load_named_plugin_not_found(self, mock_load_plugin_class: Mock):
        mock_load_plugin_class.return_value = MagicMock()

        meta = PluginMeta(
            type=PluginType.CatalogRecordProperty,
            name="TestPlugin",
            entrypoint_file="test.py",
        )

        instance = CatalogPropertyPluginInstance(
            plugin_name="TestPlugin",
            instance_name="Instance",
            property_name="Property",
            property_type={"type": "string"},
        )

        self.registry.register_from_path(meta, Path("/fake/path1"), instance)

        with self.assertRaises(ValueError) as context:
            self.registry._load_named_plugin(
                PluginType.CatalogRecordProperty, "NonExistentPlugin"
            )
        self.assertEqual(
            str(context.exception),
            "No plugin named 'NonExistentPlugin' registered "
            "for type 'CatalogRecordProperty'.",
        )

    def test_load_single_plugin_not_found(self):
        with self.assertRaises(ValueError) as context:
            self.registry._load_single_plugin(PluginType.CatalogAdapter)
        self.assertEqual(
            str(context.exception),
            "No plugin registered for type 'CatalogAdapter'.",
        )

    def test_load_single_plugin_multiple_found(self):
        self.registry._registry[PluginType.CatalogAdapter] = {
            "Plugin1": (
                MagicMock(),
                CatalogAdapterPluginInstance(
                    plugin_name="Plugin1", instance_name="Instance1"
                ),
            ),
            "Plugin2": (
                MagicMock(),
                CatalogAdapterPluginInstance(
                    plugin_name="Plugin2", instance_name="Instance2"
                ),
            ),
        }

        with self.assertRaises(ValueError) as context:
            self.registry._load_single_plugin(PluginType.CatalogAdapter)
        self.assertEqual(
            str(context.exception),
            "Multiple plugins registered for type 'CatalogAdapter'. "
            "Use 'load_named_plugin' instead.",
        )

    def test_load_multi_plugin_single_found(self):
        self.registry._registry[PluginType.CatalogRecordProperty] = (
            MagicMock(),
            CatalogPropertyPluginInstance(
                plugin_name="Plugin",
                instance_name="Instance",
                property_name="Property",
                property_type={"type": "string"},
            ),
        )

        with self.assertRaises(ValueError) as context:
            self.registry._load_named_plugin(
                PluginType.CatalogRecordProperty, "Plugin"
            )

        self.assertEqual(
            str(context.exception),
            "Single plugin registered for type 'CatalogRecordProperty'. "
            "Use 'load_single_plugin' instead.",
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
        instance = CatalogAdapterPluginInstance(
            plugin_name="PackagedPlugin", instance_name="PackagedInstance"
        )

        self.registry.register(meta, b"fake_package_data", instance)

        self.assertIn(PluginType.CatalogAdapter, self.registry._registry)
        self.assertIsInstance(
            self.registry._registry[PluginType.CatalogAdapter], tuple
        )
        self.assertEqual(
            "PackagedInstance",
            self.registry._registry[PluginType.CatalogAdapter][
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
        instance = IdentityProviderPluginInstance(
            plugin_name="TestPlugin",
            instance_name="Instance",
        )

        self.registry.register_from_path(meta, Path("/fake/path"), instance)

        plugin = self.registry.identity_provider
        self.assertIsNotNone(plugin)

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_load_catalog_record_property(self, mock_load_plugin_class: Mock):
        mock_load_plugin_class.return_value = MagicMock()

        meta = PluginMeta(
            type=PluginType.CatalogRecordProperty,
            name="TestPlugin",
            entrypoint_file="test.py",
        )
        instance = CatalogPropertyPluginInstance(
            plugin_name="TestPlugin",
            instance_name="Instance",
            property_name="Property",
            property_type={"type": "string"},
        )

        self.registry.register_from_path(meta, Path("/fake/path"), instance)

        plugin = self.registry.catalog_record_property("TestPlugin")
        self.assertIsNotNone(plugin)

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_load_document_property(self, mock_load_plugin_class: Mock):
        mock_load_plugin_class.return_value = MagicMock()

        meta = PluginMeta(
            type=PluginType.DocumentProperty,
            name="TestPlugin",
            entrypoint_file="test.py",
        )
        instance = DocumentDiscoveryPluginInstance(
            plugin_name="TestPlugin",
            instance_name="Instance",
            property_name="Property",
            property_type={"type": "string"},
        )

        self.registry.register_from_path(meta, Path("/fake/path"), instance)

        plugin = self.registry.document_property("TestPlugin")
        self.assertIsNotNone(plugin)

    @patch("vera_plugins.tools.registry.load_plugin_class")
    def test_load_document_discovery(self, mock_load_plugin_class: Mock):
        mock_load_plugin_class.return_value = MagicMock()

        meta = PluginMeta(
            type=PluginType.DocumentDiscovery,
            name="TestPlugin",
            entrypoint_file="test.py",
        )
        instance = DocumentDiscoveryPluginInstance(
            plugin_name="TestPlugin",
            instance_name="Instance",
        )

        self.registry.register_from_path(meta, Path("/fake/path"), instance)

        plugin = self.registry.document_discovery("TestPlugin")
        self.assertIsNotNone(plugin)
