from pathlib import Path
from typing import Dict, Mapping

from ..specs.base import PluginBase
from ..specs.catalog_adapter import CatalogAdapterPlugin
from ..specs.digitization_registry_adapter import (
    DigitizationRegistryAdapterPlugin,
)
from .plugin_types import PluginType, PluginTypeCardinality

PLUGIN_TYPE_CARDINALITY: Dict[PluginType, PluginTypeCardinality] = {
    PluginType.CatalogAdapter: "1",
    PluginType.DigitizationRegistryAdapter: "1",
    PluginType.CatalogRecordProperty: "0..*",
    PluginType.DocumentProperty: "0..*",
    PluginType.IdentityProvider: "1",
}

PLUGIN_TYPE_DECLARATION: Mapping[PluginType, PluginBase] = {
    PluginType.CatalogAdapter: CatalogAdapterPlugin,
    PluginType.DigitizationRegistryAdapter: DigitizationRegistryAdapterPlugin,
}

PLUGIN_TYPE_SKELETON: Mapping[PluginType, str] = {
    PluginType.CatalogAdapter: "catalog_adapter.py",
    PluginType.DigitizationRegistryAdapter: "digitization_registry_adapter.py",
    PluginType.CatalogRecordProperty: "catalog_record_property.py",
    PluginType.DocumentProperty: "document_property.py",
    PluginType.IdentityProvider: "identity_provider.py",
}


def get_plugin_type_skeleton(plugin_type: PluginType, class_name: str) -> str:
    return (
        (
            Path(__file__).resolve().parent.parent
            / "skeletons"
            / PLUGIN_TYPE_SKELETON[plugin_type]
        )
        .read_text(encoding="utf-8")
        .replace("Skeleton", class_name)
    )
