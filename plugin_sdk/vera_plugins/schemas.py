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

from pydantic import BaseModel, Field, StringConstraints, TypeAdapter

from .definitions.exceptions import DiscoveryError
from .definitions.patterns import VERSION_PATTERN
from .definitions.plugin_types import PluginType

Version = Annotated[
    str,
    StringConstraints(pattern=VERSION_PATTERN),
]


# --- Plugin Metadata ---
class PluginMeta(BaseModel):
    name: str
    type: PluginType
    version: str = Version
    author: str | None = None
    description: str | None = None
    entrypoint_file: str
    config_schema_path: str | None = None
    additional_files: List[str] | None = None

    def __repr__(self):
        additional_str = (
            f"\n{"\n    - ".join(self.additional_files)}"
            if self.additional_files
            else None
        )
        return (
            f"{self.type.value} Plugin '{self.name}:{self.version}':\n"
            f"  - Author: {self.author or ''}\n"
            f"  - Description: {self.description or ''}\n"
            f"  - Entrypoint: {self.entrypoint_file}\n"
            f"  - Config Schema: {self.config_schema_path or ''}\n"
            f"  - Additional Files: {additional_str or ''}"
        )


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

# --- Type Adapters ---
PluginInstanceTypeAdapter = TypeAdapter(PluginInstance)

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
