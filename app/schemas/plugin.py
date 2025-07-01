from typing import Any, Dict, List

from pydantic import BaseModel
from vera_plugins.definitions.plugin_types import PluginType

from adapters.indexer import Boolean, IndexerEntity, Integer, Keyword


class PluginsFilterParams(BaseModel):
    name: str | None = None
    type: PluginType | None = None


class PluginDiscoverParams(BaseModel):
    url: str


class PluginMetaBase(BaseModel):
    python_version: str
    requirements: List[str] | str
    primary_file_path: str
    config_schema_path: str | None = None
    description: str | None = None
    version: str | None = None
    author: str | None = None


class PluginMeta(PluginMetaBase):
    name: str
    type: PluginType


class PluginInstanceConfig(BaseModel):
    plugin_name: str
    instance_name: str
    config: Dict[str, Any] | None = None


class Plugin(BaseModel):
    pass


class PluginInstanceEdit(BaseModel):
    pass


class PluginInstance(BaseModel):
    pass


class PluginInstanceSummary(BaseModel):
    pass


# --------------------
# - Indexer Entities -
# --------------------
class PluginProperty(IndexerEntity):
    plugin_instance_id: Keyword
    name: Keyword


class StringPluginProperty(PluginProperty):
    value: Keyword | None = None


class IntegerPluginProperty(PluginProperty):
    value: Integer | None = None


class BooleanPluginProperty(PluginProperty):
    value: Boolean | None = None
