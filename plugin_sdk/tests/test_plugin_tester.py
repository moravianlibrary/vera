import tempfile
import textwrap
from pathlib import Path
from unittest import TestCase

from vera_plugins.definitions import PluginType
from vera_plugins.schemas import PluginInstance, PluginMeta
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
            primary_file="plugin.py",
        )

    def _instance(self):
        return PluginInstance(
            plugin_name="MockPlugin",
            instance_name="mock_instance",
            config=None,
        )

    def test_raises_if_tests_dir_missing(self):
        non_existent_path = self.tests_dir / "missing"
        with self.assertRaises(FileNotFoundError):
            PluginTester(non_existent_path)

    def test_loads_and_runs_decorated_tests(self):
        self._create_test_file(
            "test_plugin.py",
            """
            from unittest import TestCase

            def plugin_test(plugin_type=None):
                def wrapper(func):
                    func.__is_plugin_test__ = True
                    func.__plugin_type__ = plugin_type
                    return func
                return wrapper

            class MyPluginTest(TestCase):
                @plugin_test(plugin_type="CatalogAdapter")
                def test_foo(self, plugin):
                    assert plugin == "mock_plugin_instance"
            """,
        )

        # Patch registry to avoid loading actual plugins
        from vera_plugins.tools.registry import PluginRegistry

        original_register = PluginRegistry.register_from_path
        original_load = PluginRegistry._load_single_plugin

        PluginRegistry.register_from_path = lambda self, meta, path, inst: None
        PluginRegistry._load_single_plugin = (
            lambda self: "mock_plugin_instance"
        )

        try:
            tester = PluginTester(self.tests_dir)
            tester(self._meta(), Path("/fake/path"), self._instance())
        finally:
            PluginRegistry.register_from_path = original_register
            PluginRegistry._load_single_plugin = original_load

    def test_skip_non_testcase_classes(self):
        self._create_test_file(
            "test_plugin.py",
            """
            from unittest import TestCase

            def plugin_test(plugin_type=None):
                def wrapper(func):
                    func.__is_plugin_test__ = True
                    func.__plugin_type__ = plugin_type
                    return func
                return wrapper

            class NotATest:
                @plugin_test(plugin_type="CatalogAdapter")
                def test_should_not_run(self, plugin): pass

            class MyPluginTest(TestCase):
                @plugin_test(plugin_type="CatalogAdapter")
                def test_should_run(self, plugin): pass
            """,
        )

        from vera_plugins.tools.registry import PluginRegistry

        PluginRegistry.register_from_path = lambda self, meta, path, inst: None
        PluginRegistry._load_single_plugin = (
            lambda self: "mock_plugin_instance"
        )

        tester = PluginTester(self.tests_dir)
        tester(self._meta(), Path("/fake/path"), self._instance())

    def test_skips_non_decorated_or_wrong_plugin_type_tests(self):
        self._create_test_file(
            "test_plugin.py",
            """
            from unittest import TestCase

            def plugin_test(plugin_type=None):
                def wrapper(func):
                    func.__is_plugin_test__ = True
                    func.__plugin_type__ = plugin_type
                    return func
                return wrapper

            class MyPluginTest(TestCase):
                def test_irrelevant(self, plugin): pass

                @plugin_test(plugin_type="DigitizationRegistryAdapter")
                def test_wrong_type(self, plugin):
                    raise AssertionError("Should not be called")
            """,
        )

        from vera_plugins.tools.registry import PluginRegistry

        PluginRegistry.register_from_path = lambda self, meta, path, inst: None
        PluginRegistry._load_single_plugin = (
            lambda self: "mock_plugin_instance"
        )

        tester = PluginTester(self.tests_dir)
        tester(self._meta(), Path("/fake/path"), self._instance())
