import re
from enum import Enum
from pathlib import Path
from subprocess import CalledProcessError
from typing import Dict, List, Literal, Mapping

from pydantic import ValidationError
from yaml import YAMLError

from .interfaces import (
    CatalogAdapterPlugin,
    DigitizationRegistryAdapterPlugin,
    PluginBase,
)

PLUGIN_META_PATTERN = re.compile(r"\.veraplugin\.ya?ml$")
PLUGIN_INSTANCES_PATTERN = re.compile(r"\.veraplugin\.instances\.ya?ml$")


class PluginType(Enum):
    CatalogAdapter = "CatalogAdapter"
    DigitizationRegistryAdapter = "DigitizationRegistryAdapter"
    CatalogRecordProperty = "CatalogRecordProperty"
    DocumentProperty = "DocumentProperty"


class PluginState(Enum):
    Ready = "Ready"
    NewVersionAvailable = "NewVersionAvailable"
    SourceUnavailable = "SourceUnavailable"


type PluginTypeCardinality = Literal["1", "0..1", "0..*", "1..*"]

PLUGIN_TYPE_CARDINALITY: Dict[PluginType, PluginTypeCardinality] = {
    PluginType.CatalogAdapter: "1",
    PluginType.DigitizationRegistryAdapter: "1",
    PluginType.CatalogRecordProperty: "0..*",
    PluginType.DocumentProperty: "0..*",
}

PLUGIN_TYPE_DECLARATION: Mapping[PluginType, PluginBase] = {
    PluginType.CatalogAdapter: CatalogAdapterPlugin,
    PluginType.DigitizationRegistryAdapter: DigitizationRegistryAdapterPlugin,
}

PLUGIN_TESTS_PATH = Path("tests")


def patch_plugin(plugin_type: PluginType):
    def decorator(fn):
        fn.__is_plugin_test__ = True
        fn.__plugin_type__ = plugin_type
        return fn

    return decorator


class GitCloneError(Exception):
    """Raised when git clone fails."""

    def __init__(self, cmd: List[str], error: CalledProcessError):
        message = (
            f"Git clone failed:\n"
            f"Command: {' '.join(cmd)}\n"
            f"Exit Code: {error.returncode}\n"
            f"Output: {error.stdout}\n"
            f"Error: {error.stderr}"
        )
        super().__init__(message)
        self.cmd = cmd
        self.error = error


class UnimplementedFunctionsError(Exception):
    """Raised when a required function is not implemented in a plugin."""

    def __init__(
        self,
        plugin_name: str,
        plugin_type: PluginType,
        function_names: List[str],
    ):
        message = (
            f"Plugin '{plugin_name}' of type '{plugin_type.value}' "
            f"does not implement the following required functions: "
            f"{', '.join(function_names)}."
        )
        super().__init__(message)
        self.plugin_name = plugin_name
        self.plugin_type = plugin_type
        self.function_names = function_names


class PluginNotFoundError(Exception):
    """Raised when a plugin is not found."""

    def __init__(self, plugin_name: str):
        message = f"Plugin '{plugin_name}' not found in current context."
        super().__init__(message)
        self.plugin_name = plugin_name


class PluginConfigMissingError(Exception):
    def __init__(self, plugin_name: str, instance_name: str):
        super().__init__(
            f"Plugin '{plugin_name}' requires a config, "
            f"but no config is provided in instance '{instance_name}'."
        )


class UnexpectedPluginConfigError(Exception):
    def __init__(self, plugin_name: str, instance_name: str):
        super().__init__(
            f"Plugin '{plugin_name}' does not define a config schema, "
            f"but a config was provided in instance '{instance_name}'."
        )


ParseConfigError = FileNotFoundError | OSError | YAMLError | ValidationError
DiscoveryError = (
    ParseConfigError | GitCloneError | FileNotFoundError | NotADirectoryError
)
ImplementationError = TypeError | ImportError | UnimplementedFunctionsError
LintingError = DiscoveryError | ImplementationError
