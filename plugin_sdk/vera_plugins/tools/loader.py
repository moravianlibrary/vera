import sys
from importlib import util
from pathlib import Path
from typing import Type

from ..interfaces import PluginBase


def load_plugin(
    plugin_name: str, plugin_module_path: Path
) -> Type[PluginBase]:
    """
    Load a plugin class from a Python module file.

    Parameters
    ----------
    plugin_name : str
        The name of the plugin, used to create a unique module name during
        import.
    plugin_module_path : Path
        The filesystem path to the Python module file containing the plugin
        class.

    Returns
    -------
    Type[PluginBase]
        The plugin class that is a subclass of `PluginBase` found
        in the module.

    Raises
    ------
    FileNotFoundError
        If the specified plugin module path does not exist.
    ImportError
        If the module cannot be loaded from the given path.
    SyntaxError
        If the module contains invalid Python syntax.
    ValueError
        If multiple PluginBase subclasses are found in the plugin module
        or if no PluginBase subclass is found in the plugin module.
    """
    module_name = f"{plugin_name}_module"

    spec = util.spec_from_file_location(module_name, str(plugin_module_path))
    if spec is None or spec.loader is None:
        raise ImportError(
            f"Could not load plugin module from {plugin_module_path}."
        )

    module = util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)

    plugin_class = None

    for attr in dir(module):
        obj = getattr(module, attr)
        if (
            isinstance(obj, type)
            and issubclass(obj, PluginBase)
            and obj is not PluginBase
        ):
            if plugin_class is not None:
                raise ValueError(
                    "Multiple PluginBase subclasses found in plugin module."
                )
            plugin_class = obj

    if plugin_class is None:
        raise ValueError("No PluginBase subclass found in plugin module.")

    return plugin_class
