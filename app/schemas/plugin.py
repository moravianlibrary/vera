from typing import List

from pydantic import BaseModel
from vera_plugins.definitions.plugin_types import PluginType
from vera_plugins.schemas import PluginConfig, PluginMeta


# --------------------
# - Query Parameters -
# --------------------
class PluginsFilterParams(BaseModel):
    name: str | None = None
    type: PluginType | None = None


class PluginDiscoverParams(BaseModel):
    url: str


# --------------------
# - Request Payloads -
# --------------------
class PluginInstanceEdit(BaseModel):
    pass


# -----------------
# - API Responses -
# -----------------
class PluginInstanceInner(BaseModel):
    id: int
    name: str


class Plugin(BaseModel):
    id: int
    name: str
    type: PluginType
    meta: PluginMeta
    instances: List[PluginInstanceInner]


class PluginInstance(BaseModel):
    id: int
    config: PluginConfig


class PluginInstanceSummary(BaseModel):
    id: int
    name: str
    plugin_name: str
