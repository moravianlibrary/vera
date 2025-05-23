from pathlib import Path
from typing import Any, Dict, List, Tuple

from pydantic import BaseModel

from .definitions import PluginType


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


class PluginsConfig(BaseModel):
    plugins: List[PluginMeta] | None = None
    instances: List[PluginInstance] | None = None


PluginImplementation = Tuple[Path, PluginMeta, bytes]
