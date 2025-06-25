from pathlib import Path
from typing import Dict, Mapping

from vera_plugins.specs.base import PluginBase

from .definitions.plugin_types import PluginType, PluginTypeCardinality
from .specs.catalog_adapter import CatalogAdapterPlugin
from .specs.catalog_record_property import CatalogRecordPropertyPlugin
from .specs.digitization_registry_adapter import (
    DigitizationRegistryAdapterPlugin,
)
from .specs.document_discovery import DocumentDiscoveryPlugin
from .specs.document_property import DocumentPropertyPlugin
from .specs.identity_provider import IdentityProviderPlugin

PLUGIN_TYPE_CARDINALITY: Dict[PluginType, PluginTypeCardinality] = {
    PluginType.IdentityProvider: "1",
    PluginType.CatalogAdapter: "1",
    PluginType.DigitizationRegistryAdapter: "1",
    PluginType.CatalogRecordProperty: "0..*",
    PluginType.DocumentProperty: "0..*",
    PluginType.DocumentDiscovery: "0..*",
}

PLUGIN_TYPE_DECLARATION: Mapping[PluginType, PluginBase] = {
    PluginType.IdentityProvider: IdentityProviderPlugin,
    PluginType.CatalogAdapter: CatalogAdapterPlugin,
    PluginType.DigitizationRegistryAdapter: DigitizationRegistryAdapterPlugin,
    PluginType.CatalogRecordProperty: CatalogRecordPropertyPlugin,
    PluginType.DocumentProperty: DocumentPropertyPlugin,
    PluginType.DocumentDiscovery: DocumentDiscoveryPlugin,
}

PLUGIN_TYPE_SKELETON: Mapping[PluginType, str] = {
    PluginType.IdentityProvider: "identity_provider.py",
    PluginType.CatalogAdapter: "catalog_adapter.py",
    PluginType.DigitizationRegistryAdapter: "digitization_registry_adapter.py",
    PluginType.CatalogRecordProperty: "catalog_record_property.py",
    PluginType.DocumentProperty: "document_property.py",
    PluginType.DocumentDiscovery: "document_discovery.py",
}


def get_plugin_type_skeleton(plugin_type: PluginType, class_name: str) -> str:
    return (
        (
            Path(__file__).resolve().parent
            / "skeletons"
            / PLUGIN_TYPE_SKELETON[plugin_type]
        )
        .read_text(encoding="utf-8")
        .replace("Skeleton", class_name)
    )
