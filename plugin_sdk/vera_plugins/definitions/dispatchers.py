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
