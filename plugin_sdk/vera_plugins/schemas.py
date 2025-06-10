from pathlib import Path
from typing import Any, Dict, List, NamedTuple, Tuple

from pydantic import BaseModel, constr

from .definitions import VERSION_PATTERN, DiscoveryError, PluginType


class PluginMeta(BaseModel):
    name: str
    type: PluginType
    version: str = constr(pattern=VERSION_PATTERN)
    author: str | None = None
    description: str | None = None
    primary_file: str
    include_files: List[str] | None = None
    config_schema_path: str | None = None


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
