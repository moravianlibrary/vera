import json
import tempfile
from pathlib import Path
from textwrap import dedent
from unittest import TestCase

from jsonschema.exceptions import ValidationError

from vera_plugins.definitions.exceptions import (
    ConfigMissingError,
    PluginNotFoundError,
    UnexpectedConfigError,
    UnimplementedFunctionsError,
)
from vera_plugins.definitions.plugin_types import PluginType
from vera_plugins.schemas import DocumentDiscoveryConfig, PluginMeta
from vera_plugins.tools.validator import (
    _validate_json_schema,
    validate_instance,
    validate_plugin,
    validate_plugin_implementation,
)


class TestPluginImplementationValidation(TestCase):
    def _write_temp_plugin(self, content: str) -> Path:
        tmp_file = tempfile.NamedTemporaryFile("w", suffix=".py", delete=False)
        tmp_file.write(content)
        tmp_file.close()
        return Path(tmp_file.name)

    def test_valid_plugin(self):
        try:
            file_path = self._write_temp_plugin(
                dedent(
                    """
                    from vera_plugins.specs.catalog_adapter import (
                        CatalogAdapterPlugin
                    )

                    class TestPlugin(CatalogAdapterPlugin):
                        def is_available(self):
                            return True

                        def fetch(self, base, system_number):
                            return None
                    """
                )
            )

            err = validate_plugin_implementation(
                PluginType.CatalogAdapter, file_path
            )
            self.assertIsNone(err)
        finally:
            file_path.unlink()

    def test_fetch_load_exceptions(self):
        fake_path = Path("/nonexistent/plugin.py")
        err = validate_plugin_implementation(
            PluginType.CatalogAdapter, fake_path
        )
        self.assertIsInstance(err, FileNotFoundError)

    def test_wrong_type(self):
        try:
            file_path = self._write_temp_plugin(
                dedent(
                    """
                    from vera_plugins.specs.catalog_adapter import (
                        CatalogAdapterPlugin
                    )

                    class TestPlugin(CatalogAdapterPlugin):
                        def is_available(self):
                            return True

                        def fetch(self, base, system_number):
                            return None
                    """
                )
            )

            err = validate_plugin_implementation(
                PluginType.DigitizationRegistryAdapter, file_path
            )
            self.assertIsInstance(err, TypeError)
            self.assertEqual(
                "Plugin class 'TestPlugin' does not implement "
                "expected interface 'DigitizationRegistryAdapterPlugin'.",
                str(err),
            )
        finally:
            file_path.unlink()

    def test_unimplemented_functionality(self):
        try:
            file_path = self._write_temp_plugin(
                dedent(
                    """
                    from vera_plugins.specs.catalog_adapter import (
                        CatalogAdapterPlugin
                    )

                    class TestPlugin(CatalogAdapterPlugin):
                        def fetch(self, base, system_number):
                            return None
                    """
                )
            )

            err = validate_plugin_implementation(
                PluginType.CatalogAdapter, file_path
            )
            self.assertIsInstance(err, UnimplementedFunctionsError)
            self.assertEqual(
                "Plugin 'TestPlugin' of type 'CatalogAdapter' does not "
                "implement the following required functions: is_available.",
                str(err),
            )
        finally:
            file_path.unlink()


class TestPluginValidation(TestCase):
    def create_temp_valid_plugin(self, tmpdir: Path) -> PluginMeta:
        tmp_file = tmpdir / "plugin.py"
        with tmp_file.open("w") as f:
            f.write(
                dedent(
                    """
                    from vera_plugins.specs.catalog_adapter import (
                        CatalogAdapterPlugin
                    )

                    class TestPlugin(CatalogAdapterPlugin):
                        def is_available(self):
                            return True
                        def fetch(self, base, system_number):
                            return None
                    """
                )
            )
        return PluginMeta(
            name="TestPlugin",
            type=PluginType.CatalogAdapter,
            entrypoint_file="plugin.py",
            version="1.0.0",
        )

    def test_non_existent_entrypoint_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            meta = PluginMeta(
                name="TestPlugin",
                type=PluginType.CatalogAdapter,
                entrypoint_file="non_existent.py",
                version="1.0.0",
            )
            err = validate_plugin(Path(tmpdir), meta)
            self.assertEqual(len(err), 1)
            self.assertIsInstance(err[0], FileNotFoundError)
            self.assertIn("not found.", str(err[0]))

    def test_missing_additional_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)

            meta = self.create_temp_valid_plugin(tmpdir_path)
            meta.additional_files = ["missing_file.py"]

            err = validate_plugin(tmpdir_path, meta)
            self.assertEqual(len(err), 1)
            self.assertIsInstance(err[0], FileNotFoundError)

    def test_missing_config_schema(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)

            meta = self.create_temp_valid_plugin(tmpdir_path)
            meta.settings_schema_path = "missing_schema.json"

            err = validate_plugin(tmpdir_path, meta)
            self.assertEqual(len(err), 1)
            self.assertIsInstance(err[0], FileNotFoundError)

    def test_valid_plugin(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)

            meta = self.create_temp_valid_plugin(tmpdir_path)
            meta.settings_schema_path = "valid_schema.json"

            schema_content = {
                "type": "object",
                "properties": {"example_property": {"type": "string"}},
                "required": ["example_property"],
            }

            schema_file = tmpdir_path / meta.settings_schema_path
            with schema_file.open("w") as f:
                json.dump(schema_content, f)

            err = validate_plugin(tmpdir_path, meta)
            self.assertEqual(len(err), 0)


class TestConfigValidation(TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.dir_path = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def _create_schema_file(self, rel_path: str, schema: dict) -> Path:
        path = self.dir_path / rel_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(schema))
        return path

    def _plugin_meta(self, name: str, schema_file: str | None = None):
        return PluginMeta(
            name=name,
            type=PluginType.CatalogAdapter,
            version="1.0.0",
            entrypoint_file="plugin.py",
            settings_schema_path=schema_file,
        )

    def test_plugin_not_found(self):
        instance = DocumentDiscoveryConfig(
            plugin_name="missing_plugin", instance_name="example"
        )
        result = validate_instance(self.dir_path, instance, [])
        self.assertIsInstance(result, PluginNotFoundError)

    def test_config_missing_but_expected(self):
        schema_file = "schema.json"
        self._create_schema_file(schema_file, {"type": "object"})
        meta = self._plugin_meta("TestPlugin", schema_file)

        instance = DocumentDiscoveryConfig(
            plugin_name="TestPlugin",
            instance_name="instance1",
            config=None,
        )
        result = validate_instance(self.dir_path, instance, [meta])
        self.assertIsInstance(result, ConfigMissingError)

    def test_config_provided_but_unexpected(self):
        meta = self._plugin_meta("TestPlugin", schema_file=None)
        instance = DocumentDiscoveryConfig(
            plugin_name="TestPlugin",
            instance_name="instance1",
            plugin_settings={"foo": "bar"},
        )
        result = validate_instance(self.dir_path, instance, [meta])
        self.assertIsInstance(result, UnexpectedConfigError)

    def test_invalid_config(self):
        schema_file = "schema.json"
        self._create_schema_file(
            schema_file,
            {
                "type": "object",
                "properties": {"x": {"type": "string"}},
                "required": ["x"],
            },
        )

        meta = self._plugin_meta("TestPlugin", schema_file)
        instance = DocumentDiscoveryConfig(
            plugin_name="TestPlugin",
            instance_name="instance1",
            plugin_settings={"x": 123},
        )

        result = validate_instance(self.dir_path, instance, [meta])
        self.assertIsInstance(result, ValidationError)
        self.assertIn("123 is not of type 'string'", str(result))

    def test_valid_config(self):
        schema_file = "schema.json"
        self._create_schema_file(
            schema_file,
            {
                "type": "object",
                "properties": {"x": {"type": "string"}},
                "required": ["x"],
            },
        )

        meta = self._plugin_meta("TestPlugin", schema_file)
        instance = DocumentDiscoveryConfig(
            plugin_name="TestPlugin",
            instance_name="instance1",
            plugin_settings={"x": "hello"},
        )

        result = validate_instance(self.dir_path, instance, [meta])
        self.assertIsNone(result)

    def test_valid_config_without_schema(self):
        meta = self._plugin_meta("TestPlugin")
        instance = DocumentDiscoveryConfig(
            plugin_name="TestPlugin",
            instance_name="instance1",
        )

        result = validate_instance(self.dir_path, instance, [meta])
        self.assertIsNone(result)


class TestJsonSchemaValidation(TestCase):
    def test_valid_schema(self):
        schema = {"type": "object", "properties": {"name": {"type": "string"}}}
        with tempfile.NamedTemporaryFile("w+", delete=False) as tmp:
            json.dump(schema, tmp)
            tmp_path = Path(tmp.name)

        try:
            result = _validate_json_schema(tmp_path)
            self.assertIsNone(result)
        finally:
            tmp_path.unlink()

    def test_invalid_json(self):
        with tempfile.NamedTemporaryFile("w+", delete=False) as tmp:
            tmp.write("{invalid json}")
            tmp_path = Path(tmp.name)

        try:
            result = _validate_json_schema(tmp_path)
            self.assertIsInstance(result, json.JSONDecodeError)
        finally:
            tmp_path.unlink()
