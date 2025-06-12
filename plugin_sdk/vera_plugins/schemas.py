from pathlib import Path
from typing import (
    Annotated,
    Any,
    Dict,
    List,
    Literal,
    NamedTuple,
    Tuple,
    TypeVar,
    Union,
)

from pydantic import BaseModel, Field, TypeAdapter, constr

from .definitions.data_property import PropertyTypeSchema
from .definitions.exceptions import DiscoveryError
from .definitions.patterns import VERSION_PATTERN
from .definitions.plugin_types import PluginType


# --- Plugin Metadata ---
class PluginMeta(BaseModel):
    name: str
    type: PluginType
    version: str = constr(pattern=VERSION_PATTERN)
    author: str | None = None
    description: str | None = None
    entrypoint_file: str
    config_schema_path: str | None = None
    additional_files: List[str] | None = None


PluginMetas = List[PluginMeta]


# --- Plugin Instances ---
class PluginInstanceBase(BaseModel):
    plugin_name: str
    instance_name: str
    config: Dict[str, Any] | None = None


class CatalogAdapterPluginInstance(PluginInstanceBase):
    plugin_type: Literal[PluginType.CatalogAdapter] = PluginType.CatalogAdapter
    query_schema: Dict[str, Any] | None = None
    fetch_changes: bool = False
    search: bool = False


class CatalogPropertyPluginInstance(PluginInstanceBase):
    plugin_type: Literal[PluginType.CatalogRecordProperty] = (
        PluginType.CatalogRecordProperty
    )
    property_name: str
    property_type: PropertyTypeSchema
    propagate_to_documents: bool = False


class DigitizationRegistryPluginInstance(PluginInstanceBase):
    plugin_type: Literal[PluginType.DigitizationRegistryAdapter] = (
        PluginType.DigitizationRegistryAdapter
    )
    change_state: bool = False


class DocumentDiscoveryPluginInstance(PluginInstanceBase):
    plugin_type: Literal[PluginType.DocumentDiscovery] = (
        PluginType.DocumentDiscovery
    )


class DocumentPropertyPluginInstance(PluginInstanceBase):
    plugin_type: Literal[PluginType.DocumentProperty] = (
        PluginType.DocumentProperty
    )
    property_name: str
    property_type: PropertyTypeSchema


class IdentityProviderPluginInstance(PluginInstanceBase):
    plugin_type: Literal[PluginType.IdentityProvider] = (
        PluginType.IdentityProvider
    )


PluginInstance = Annotated[
    Union[
        CatalogAdapterPluginInstance,
        CatalogPropertyPluginInstance,
        DigitizationRegistryPluginInstance,
        DocumentDiscoveryPluginInstance,
        DocumentPropertyPluginInstance,
        IdentityProviderPluginInstance,
    ],
    Field(discriminator="plugin_type"),
]

PluginInstances = List[PluginInstance]

PluginInstanceTypeAdapter = TypeAdapter(PluginInstance)

# --- Type Adapters ---
PluginModelType = TypeVar(
    "PluginModelType",
    bound=Union[PluginMeta, TypeAdapter[PluginInstance]],
)

# --- Plugin Implementation ---
PluginImplementation = Tuple[Path, PluginMeta, bytes]


# --- Discovery Results ---
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
