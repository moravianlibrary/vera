import tempfile
import textwrap
from pathlib import Path
from unittest import TestCase
from unittest.mock import Mock, patch

from vera_plugins.definitions.plugin_types import PluginType
from vera_plugins.schemas import CatalogAdapterPluginInstance, PluginMeta
from vera_plugins.tools.tester import PluginTester


class TestPluginTester(TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.tests_dir = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def _create_test_file(self, name: str, content: str):
        path = self.tests_dir / name
        path.write_text(textwrap.dedent(content))

    def _meta(self):
        return PluginMeta(
            name="MockPlugin",
            type=PluginType.CatalogAdapter,
            version="1.0.0",
            entrypoint_file="plugin.py",
        )

    def _instance(self):
        return CatalogAdapterPluginInstance(
            plugin_name="MockPlugin",
            instance_name="mock_instance",
            config=None,
        )

    def test_raises_if_tests_dir_missing(self):
        non_existent_path = self.tests_dir / "missing"
        with self.assertRaises(FileNotFoundError):
            PluginTester(non_existent_path)

    @patch(
        "vera_plugins.tools.registry.PluginRegistry.register_from_path",
        return_value=None,
    )
    @patch(
        "vera_plugins.tools.registry.PluginRegistry._load_singleton_plugin",
        return_value="mock_plugin_instance",
    )
    def test_loads_and_runs_decorated_tests(
        self, mock_load_singleton_plugin: Mock, mock_register_from_path: Mock
    ):
        self._create_test_file(
            "test_plugin.py",
            """
            from unittest import TestCase
            from vera_plugins.definitions.decorators import patch_plugin

            class MyPluginTest(TestCase):
                @patch_plugin(plugin_type="CatalogAdapter")
                def test_foo(self, plugin):
                    assert plugin == "mock_plugin_instance"
            """,
        )

        tester = PluginTester(self.tests_dir)
        tester(self._meta(), Path("/fake/path"), self._instance())

    @patch(
        "vera_plugins.tools.registry.PluginRegistry.register_from_path",
        return_value=None,
    )
    @patch(
        "vera_plugins.tools.registry.PluginRegistry._load_singleton_plugin",
        return_value="mock_plugin_instance",
    )
    def test_skip_non_testcase_classes(
        self, mock_load_singleton_plugin: Mock, mock_register_from_path: Mock
    ):
        self._create_test_file(
            "test_plugin.py",
            """
            from unittest import TestCase
            from vera_plugins.definitions.decorators import patch_plugin

            class NotATest:
                @patch_plugin(plugin_type="CatalogAdapter")
                def test_should_not_run(self, plugin): pass

            class MyPluginTest(TestCase):
                @patch_plugin(plugin_type="CatalogAdapter")
                def test_should_run(self, plugin): pass
            """,
        )

        tester = PluginTester(self.tests_dir)
        tester(self._meta(), Path("/fake/path"), self._instance())

    @patch(
        "vera_plugins.tools.registry.PluginRegistry.register_from_path",
        return_value=None,
    )
    @patch(
        "vera_plugins.tools.registry.PluginRegistry._load_singleton_plugin",
        return_value="mock_plugin_instance",
    )
    def test_skips_non_decorated_or_wrong_plugin_type_tests(
        self, mock_load_singleton_plugin: Mock, mock_register_from_path: Mock
    ):
        self._create_test_file(
            "test_plugin.py",
            """
            from unittest import TestCase
            from vera_plugins.definitions.decorators import patch_plugin

            class MyPluginTest(TestCase):
                def test_irrelevant(self, plugin): pass

                @patch_plugin(plugin_type="DigitizationRegistryAdapter")
                def test_wrong_type(self, plugin):
                    raise AssertionError("Should not be called")
            """,
        )

        tester = PluginTester(self.tests_dir)
        tester(self._meta(), Path("/fake/path"), self._instance())
