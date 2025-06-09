import tempfile
from pathlib import Path
from textwrap import dedent
from unittest import TestCase

from vera_plugins.interfaces import PluginBase
from vera_plugins.tools.loader import load_plugin


class TestPluginLoader(TestCase):
    def _write_temp_plugin(self, content: str) -> Path:
        tmp_file = tempfile.NamedTemporaryFile("w", suffix=".py", delete=False)
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
            plugin_class = load_plugin("myplugin", plugin_path)
            self.assertTrue(issubclass(plugin_class, PluginBase))
            self.assertEqual(plugin_class.__name__, "MyTestPlugin")
        finally:
            plugin_path.unlink()

    def test_load_plugin_from_non_existing_file(self):
        with self.assertRaises(FileNotFoundError):
            load_plugin("brokenplugin", Path("/non/existent/path.py"))

    def test_load_plugin_from_invalid_file(self):
        plugin_code = "not a valid python code"
        plugin_path = self._write_temp_plugin(plugin_code)
        try:
            with self.assertRaises(SyntaxError):
                load_plugin("invalidsyntaxplugin", plugin_path)
        finally:
            plugin_path.unlink()

    def test_load_plugin_with_no_plugin_base(self):
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
                load_plugin("nopluginbase", plugin_path)
            self.assertIn(
                "No PluginBase subclass found in plugin module.",
                str(context.exception),
            )
        finally:
            plugin_path.unlink()

    def test_load_plugin_with_multiple_plugins(self):
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
                load_plugin("multipleplugins", plugin_path)
            self.assertIn(
                "Multiple PluginBase subclasses found in plugin module.",
                str(context.exception),
            )
        finally:
            plugin_path.unlink()

    def test_load_plugin_with_invalid_file_extension(self):
        plugin_code = dedent(
            """
            from vera_plugins.interfaces import PluginBase

            class ValidPlugin(PluginBase):
                def run(self):
                    pass
        """
        )
        plugin_path = self._write_temp_plugin(plugin_code)
        try:
            with self.assertRaises(ImportError) as context:
                load_plugin(
                    "invalidextension", plugin_path.with_suffix(".txt")
                )
            self.assertIn(
                "Could not load plugin module", str(context.exception)
            )
        finally:
            plugin_path.unlink()
