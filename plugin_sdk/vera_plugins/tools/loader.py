import inspect
import sys
from importlib import util
from pathlib import Path
from typing import Type

from ..interfaces import PluginBase


def load_plugin_class(plugin_name: str, file_path: Path) -> Type[PluginBase]:
    """
    Load and return a single `PluginBase` subclass from a Python module file.

    This function dynamically loads a Python module from the given file path
    and searches for exactly one subclass of `PluginBase` within it.
    If multiple or no valid subclasses are found, an exception is raised.

    Parameters
    ----------
    plugin_name : str
        A unique name used to construct the module name during dynamic import.
    file_path : Path
        The filesystem path to the Python module containing the plugin class.

    Returns
    -------
    Type[PluginBase]
        The discovered plugin class that inherits from `PluginBase`.

    Raises
    ------
    FileNotFoundError
        If the file does not exist at the given path.
    ImportError
        If the module cannot be loaded or executed due to import errors.
    ValueError
        If no subclass of `PluginBase` is found,
        or if multiple subclasses are found.
    """
    if not file_path.is_file():
        raise FileNotFoundError(f"Plugin file '{file_path}' not found.")

    module_name = f"{plugin_name}_module"

    spec = util.spec_from_file_location(module_name, file_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load plugin module from {file_path}.")

    module = util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)

    plugin_classes = [
        cls
        for _, cls in inspect.getmembers(module, inspect.isclass)
        if cls.__module__ == module_name
        and issubclass(cls, PluginBase)
        and cls is not PluginBase
    ]

    if not plugin_classes:
        raise ValueError(
            f"No PluginBase subclass found in plugin module "
            f"'{file_path.name}'."
        )
    if len(plugin_classes) > 1:
        raise ValueError(
            f"Multiple PluginBase subclasses found in '{file_path.name}'."
        )

    return plugin_classes[0]
