from enum import Enum
from subprocess import CalledProcessError
from typing import List, Mapping

from .interfaces import (
    CatalogAdapterPlugin,
    DigitizationRegistryAdapterPlugin,
    PluginBase,
)

PLUGIN_META_FILENAMES = [".veraplugin.yaml", ".veraplugin.yml"]


class PluginType(Enum):
    CatalogAdapter = "CatalogAdapter"
    DigitizationRegistryAdapter = "DigitizationRegistryAdapter"
    CatalogRecordProperty = "CatalogRecordProperty"
    DocumentProperty = "DocumentProperty"


class PluginState(Enum):
    Ready = "Ready"
    NewVersionAvailable = "NewVersionAvailable"
    SourceUnavailable = "SourceUnavailable"


PLUGIN_TYPE_TO_DECLARATION: Mapping[PluginType, PluginBase] = {
    PluginType.CatalogAdapter: CatalogAdapterPlugin,
    PluginType.DigitizationRegistryAdapter: DigitizationRegistryAdapterPlugin,
}


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
