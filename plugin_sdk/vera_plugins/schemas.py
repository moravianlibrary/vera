from pathlib import Path
from typing import Any, Dict, List, NamedTuple, Tuple

from pydantic import BaseModel

from .definitions import DiscoveryError, PluginType


# TODO: Validate python version (3.6-3.13) and version (1.0.0)
class PluginMeta(BaseModel):
    name: str
    type: PluginType
    python_version: str
    requirements: List[str] | str
    primary_file: str
    include_files: List[str] | None = None
    config_schema_path: str | None = None
    description: str | None = None
    version: str | None = None
    author: str | None = None


class PluginInstance(BaseModel):
    plugin_name: str
    instance_name: str
    config: Dict[str, Any] | None = None


class DiscoveryResult(NamedTuple):
    file_path: Path
    item: PluginMeta | PluginInstance | None
    error: DiscoveryError | None


class MetaDiscoveryResult(NamedTuple):
    file_path: Path
    item: PluginMeta | None
    error: DiscoveryError | None


class InstanceDiscoveryResult(NamedTuple):
    file_path: Path
    item: PluginInstance | None
    error: DiscoveryError | None


PluginMetas = List[PluginMeta]
PluginInstances = List[PluginInstance]

PluginImplementation = Tuple[Path, PluginMeta, bytes]
