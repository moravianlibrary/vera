import tempfile
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from vera_plugins.definitions import PluginType
from vera_plugins.tools.discovery import (
    discover_plugin_instances,
    discover_plugins,
)


class TestPluginDiscovery(TestCase):
    def test_discover_dir_without_plugin_config(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            self.assertEqual(discover_plugins(tmpdir), [])

    def test_discover_plugin_with_valid_minimal_config(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            config_file = tmp_path / ".veraplugin.yaml"
            config_file.write_text(
                "name: TestPlugin\n"
                "type: CatalogAdapter\n"
                "version: 1.0.0\n"
                "primary_file: test.py\n"
            )

            result = discover_plugins(tmpdir)

            self.assertEqual(len(result), 1)
            self.assertEqual(result[0].item.name, "TestPlugin")
            self.assertEqual(result[0].item.type, PluginType.CatalogAdapter)
            self.assertEqual(result[0].item.version, "1.0.0")
            self.assertEqual(result[0].item.primary_file, "test.py")
            self.assertIsNone(result[0].error)

    def test_discover_plugin_with_valid_maximal_config(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            config_file = tmp_path / ".veraplugin.yaml"
            config_file.write_text(
                "name: TestPlugin\n"
                "type: CatalogAdapter\n"
                "version: 1.0.0\n"
                "author: Test Author\n"
                "description: A test plugin for discovery.\n"
                "primary_file: test.py\n"
                "include_files:\n"
                "  - extra_file_1.py\n"
                "  - extra_file_2.py\n"
                "config_schema_path: config_schema.yaml\n"
            )

            result = discover_plugins(tmpdir)

            self.assertEqual(len(result), 1)
            self.assertEqual(result[0].item.name, "TestPlugin")
            self.assertEqual(result[0].item.type, PluginType.CatalogAdapter)
            self.assertEqual(result[0].item.version, "1.0.0")
            self.assertEqual(result[0].item.author, "Test Author")
            self.assertEqual(
                result[0].item.description, "A test plugin for discovery."
            )
            self.assertEqual(result[0].item.primary_file, "test.py")
            self.assertEqual(
                result[0].item.include_files,
                ["extra_file_1.py", "extra_file_2.py"],
            )
            self.assertEqual(
                result[0].item.config_schema_path, "config_schema.yaml"
            )

    @patch("vera_plugins.tools.discovery.clone_git_repo")
    def test_discover_plugin_with_valid_config_from_git(self, mock_clone):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)

            mock_clone.return_value = tmp_path

            config_file = tmp_path / ".veraplugin.yaml"
            config_file.write_text(
                "name: TestPlugin\n"
                "type: CatalogAdapter\n"
                "version: 1.0.0\n"
                "primary_file: test.py\n"
            )

            primary_file = tmp_path / "test.py"
            primary_file.write_text("# Test plugin primary file")

            result = discover_plugins("https://example.com/repo.git")

            self.assertEqual(len(result), 1)
            self.assertEqual(result[0].item.name, "TestPlugin")
            self.assertEqual(result[0].item.type, PluginType.CatalogAdapter)
            self.assertEqual(result[0].item.version, "1.0.0")
            self.assertEqual(result[0].item.primary_file, "test.py")
            self.assertIsNone(result[0].error)

    def test_discover_plugin_with_invalid_config(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            config_file = tmp_path / ".veraplugin.yaml"
            config_file.write_text(
                "name: TestPlugin\n" "type: InvalidType\n" "version: 1.0.0\n"
            )

            result = discover_plugins(tmpdir)

            self.assertEqual(len(result), 1)
            self.assertIsNone(result[0].item)
            self.assertIsNotNone(result[0].error)
            self.assertIn(
                "2 validation errors for PluginMeta", str(result[0].error)
            )

    def test_discover_plugins_in_nonexistent_directory(self):
        result = discover_plugins("/path/to/nonexistent/directory")

        self.assertEqual(len(result), 1)
        self.assertIsNone(result[0].item)
        self.assertIsNotNone(result[0].error)
        self.assertIsInstance(result[0].error, FileNotFoundError)

    def test_discover_plugins_in_non_directory_path(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir) / "not_a_directory.txt"
            tmp_path.write_text("This is not a directory.")

            result = discover_plugins(str(tmp_path))

            self.assertEqual(len(result), 1)
            self.assertIsNone(result[0].item)
            self.assertIsNotNone(result[0].error)
            self.assertIsInstance(result[0].error, NotADirectoryError)

    def test_discover_plugin_instances(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            config_file = tmp_path / ".veraplugin.instances.yaml"
            config_file.write_text(
                "plugin_name: TestPlugin\n"
                "instance_name: TestInstance\n"
                "config:\n"
                "  key: value\n"
            )

            result = discover_plugin_instances(tmpdir, "TestPlugin")

            self.assertEqual(len(result), 1)
            self.assertEqual(result[0].item.plugin_name, "TestPlugin")
            self.assertEqual(result[0].item.instance_name, "TestInstance")
            self.assertEqual(result[0].item.config, {"key": "value"})
            self.assertIsNone(result[0].error)
