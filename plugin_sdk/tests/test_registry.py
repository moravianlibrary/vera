import unittest
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch

from vera_plugins.definitions import PluginType
from vera_plugins.schemas import PluginInstance, PluginMeta
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
            primary_file="test.py",
        )
        instance = PluginInstance(
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
            primary_file="test1.py",
        )
        instance1 = PluginInstance(
            plugin_name="TestPlugin1", instance_name="Instance1"
        )

        meta2 = PluginMeta(
            type=PluginType.CatalogAdapter,
            name="TestPlugin2",
            primary_file="test2.py",
        )
        instance2 = PluginInstance(
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
            primary_file="test1.py",
        )

        instance1 = PluginInstance(
            plugin_name="TestPlugin1", instance_name="Instance"
        )
        instance2 = PluginInstance(
            plugin_name="TestPlugin2", instance_name="Instance"
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
            primary_file="test.py",
        )
        instance = PluginInstance(
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
            primary_file="test.py",
        )
        instance = PluginInstance(
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
            primary_file="test.py",
        )
        instance = PluginInstance(
            plugin_name="TestPlugin", instance_name="Instance"
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
            primary_file="test.py",
        )

        instance = PluginInstance(
            plugin_name="TestPlugin", instance_name="Instance"
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
                PluginInstance(
                    plugin_name="Plugin1", instance_name="Instance1"
                ),
            ),
            "Plugin2": (
                MagicMock(),
                PluginInstance(
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
            PluginInstance(plugin_name="Plugin1", instance_name="Instance1"),
        )

        with self.assertRaises(ValueError) as context:
            self.registry._load_named_plugin(
                PluginType.CatalogRecordProperty, "Plugin1"
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
            primary_file="packaged.py",
        )
        instance = PluginInstance(
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
