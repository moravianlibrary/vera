from subprocess import CalledProcessError
from typing import List

from pydantic import ValidationError
from yaml import YAMLError

from .plugin_types import PluginType


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
