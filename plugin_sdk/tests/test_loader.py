import sys
import tempfile
from pathlib import Path
from textwrap import dedent
from unittest import TestCase

from vera_plugins.interfaces import PluginBase
from vera_plugins.tools.loader import load_plugin_class


class TestPluginLoader(TestCase):
    def _write_temp_plugin(self, content: str, suffix: str = ".py") -> Path:
        tmp_file = tempfile.NamedTemporaryFile(
            "w", suffix=suffix, delete=False
        )
        tmp_file.write(content)
        tmp_file.close()
        return Path(tmp_file.name)

    def test_load_valid_plugin(self):
        plugin_code = dedent(
            """
            from vera_plugins.interfaces import PluginBase

            class MyTestPlugin(PluginBase):
                def run(self):
                    pass
        """
        )
        plugin_path = self._write_temp_plugin(plugin_code)
        try:
            plugin_class = load_plugin_class("myplugin", plugin_path)
            self.assertTrue(issubclass(plugin_class, PluginBase))
            self.assertEqual(plugin_class.__name__, "MyTestPlugin")
        finally:
            plugin_path.unlink()

    def test_load_plugin_class_from_non_existing_file(self):
        with self.assertRaises(FileNotFoundError):
            load_plugin_class("brokenplugin", Path("/non/existent/path.py"))

    def test_load_plugin_class_from_invalid_file(self):
        plugin_code = "not a valid python code"
        plugin_path = self._write_temp_plugin(plugin_code)
        try:
            with self.assertRaises(SyntaxError):
                load_plugin_class("invalidsyntaxplugin", plugin_path)
        finally:
            plugin_path.unlink()

    def test_load_plugin_class_with_no_plugin_base(self):
        plugin_code = dedent(
            """
            class NotAPlugin:
                def run(self):
                    pass
        """
        )
        plugin_path = self._write_temp_plugin(plugin_code)
        try:
            with self.assertRaises(ValueError) as context:
                load_plugin_class("nopluginbase", plugin_path)
            self.assertIn(
                "No PluginBase subclass found in plugin module",
                str(context.exception),
            )
        finally:
            plugin_path.unlink()

    def test_load_plugin_class_with_multiple_plugins(self):
        plugin_code = dedent(
            """
            from vera_plugins.interfaces import PluginBase

            class FirstPlugin(PluginBase):
                def run(self):
                    pass

            class SecondPlugin(PluginBase):
                def run(self):
                    pass
        """
        )
        plugin_path = self._write_temp_plugin(plugin_code)
        try:
            with self.assertRaises(ValueError) as context:
                load_plugin_class("multipleplugins", plugin_path)
            self.assertIn(
                "Multiple PluginBase subclasses found in",
                str(context.exception),
            )
        finally:
            plugin_path.unlink()

    def test_load_plugin_class_with_invalid_file_extension(self):
        plugin_code = dedent(
            """
            from vera_plugins.interfaces import PluginBase

            class ValidPlugin(PluginBase):
                def run(self):
                    pass
        """
        )
        plugin_path = self._write_temp_plugin(plugin_code, ".txt")
        try:
            with self.assertRaises(ImportError) as context:
                load_plugin_class("invalidextension", plugin_path)
            self.assertIn(
                "Could not load plugin module", str(context.exception)
            )
        finally:
            plugin_path.unlink()

    def test_load_plugin_with_referenced_functionality(self):
        plugin_code = dedent(
            """
            def run():
                return "Hello from run function"
        """
        )
        plugin_path = self._write_temp_plugin(plugin_code)

        entrypoint_code = dedent(
            """
            from vera_plugins.interfaces import PluginBase
            from {plugin_path} import run

            class TestPlugin(PluginBase):
                def run(self):
                    return run()
        """.format(
                plugin_path=plugin_path.stem
            )
        )
        entrypoint_path = self._write_temp_plugin(entrypoint_code)

        sys.path.insert(0, str(plugin_path.parent))

        try:
            plugin_class = load_plugin_class(
                "referencedplugin", entrypoint_path
            )
            self.assertTrue(issubclass(plugin_class, PluginBase))
            self.assertEqual(plugin_class.__name__, "TestPlugin")
            self.assertEqual(plugin_class().run(), "Hello from run function")
        finally:
            plugin_path.unlink()
            entrypoint_path.unlink()
