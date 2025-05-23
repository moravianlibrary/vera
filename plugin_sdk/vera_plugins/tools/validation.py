import inspect
import sys
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from ..definitions import PLUGIN_TYPE_TO_DECLARATION, PluginType


def validate_interface_implementation(
    plugin_type: PluginType,
    primary_file: Path,
) -> None:
    expected_interface = PLUGIN_TYPE_TO_DECLARATION[plugin_type]
    module_name = f"_plugin_validate_{primary_file.stem}"

    spec = spec_from_file_location(module_name, primary_file)
    if spec is None or spec.loader is None:
        raise ImportError(
            f"Unable to load spec for plugin file: {primary_file}"
        )

    module = module_from_spec(spec)
    sys.modules[module_name] = module

    try:
        spec.loader.exec_module(module)
    except Exception as e:
        raise ImportError(f"Error loading module '{primary_file}': {e}") from e

    for _, cls in inspect.getmembers(module, inspect.isclass):
        try:
            if (
                issubclass(cls, expected_interface)
                and cls is not expected_interface
            ):
                return
        except TypeError:
            continue

    raise TypeError(
        f"No class implementing '{expected_interface.__name__}' "
        f"found in '{primary_file.name}'."
    )
