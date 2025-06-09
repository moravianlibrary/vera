import json
from pathlib import Path
from typing import List

from jsonschema.exceptions import SchemaError, ValidationError
from jsonschema.validators import Draft202012Validator

from ..definitions import (
    PLUGIN_TYPE_DECLARATION,
    ImplementationError,
    LintingError,
    PluginConfigMissingError,
    PluginNotFoundError,
    PluginType,
    UnexpectedPluginConfigError,
    UnimplementedFunctionsError,
)
from ..schemas import PluginInstance, PluginMeta
from ..tools.loader import load_plugin_class


def validate_plugin_implementation(
    plugin_type: PluginType,
    primary_file_path: Path,
) -> None | ImplementationError:
    expected_interface = PLUGIN_TYPE_DECLARATION[plugin_type]
    module_name = f"_plugin_validation_{primary_file_path.stem}"

    try:
        plugin_class = load_plugin_class(module_name, primary_file_path)
    except (FileNotFoundError, ImportError, SyntaxError, ValueError) as e:
        return e

    if (
        not issubclass(plugin_class, expected_interface)
        or plugin_class is expected_interface
    ):
        return TypeError(
            f"Plugin class '{plugin_class.__name__}' does not implement "
            f"expected interface '{expected_interface.__name__}'."
        )

    unimplemented = getattr(plugin_class, "__abstractmethods__", set())
    if unimplemented:
        return UnimplementedFunctionsError(
            plugin_class.__name__, list(unimplemented)
        )

    return None


def _validate_json_schema(path: Path) -> None:
    try:
        with open(path, "r") as f:
            Draft202012Validator.check_schema(json.load(f))
    except (json.JSONDecodeError, SchemaError) as e:
        return e


def validate_plugin(dir: Path, meta: PluginMeta) -> List[LintingError]:
    errors: List[LintingError] = []

    def validate_file_exists(file_path: Path, file_description: str):
        if not file_path.is_file():
            errors.append(
                FileNotFoundError(
                    f"{file_description} '{file_path}' not found "
                    f"for plugin '{meta.name}' in directory '{dir}'."
                )
            )

    validate_file_exists(dir / meta.primary_file, "Primary file")
    err = validate_plugin_implementation(meta.type, dir / meta.primary_file)
    if err:
        errors.append(err)

    if meta.include_files:
        for include_file in meta.include_files:
            validate_file_exists(
                dir / include_file, f"Include file '{include_file}'"
            )

    validate_file_exists(dir / meta.config_schema_path, "Config schema file")
    err = _validate_json_schema(dir / meta.config_schema_path)
    if err:
        errors.append(err)

    if meta.tests_path:
        if not (dir / meta.tests_path).is_dir():
            errors.append(
                FileNotFoundError(
                    f"Tests directory '{meta.tests_path}' not found "
                    f"for plugin '{meta.name}' in directory '{dir}'."
                )
            )

    return errors


def validate_instance(
    dir: Path, instance: PluginInstance, candidate_metas: List[PluginMeta]
) -> None | LintingError:
    meta = next(
        (m for m in candidate_metas if m.name == instance.plugin_name),
        None,
    )

    if not meta:
        return PluginNotFoundError(instance.plugin_name)

    if not instance.config:
        if meta.config_schema_path is None:
            return None

        return PluginConfigMissingError(
            instance.plugin_name, instance.instance_name
        )

    if not meta.config_schema_path:
        return UnexpectedPluginConfigError(
            instance.plugin_name, instance.instance_name
        )

    with open(dir / meta.config_schema_path, "r") as f:
        schema = json.load(f)

    try:
        Draft202012Validator(schema).validate(instance.config)
    except ValidationError as e:
        return e
