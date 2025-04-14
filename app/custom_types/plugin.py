from enum import Enum


class PluginType(Enum):
    CatalogAdapter = "CatalogAdapter"
    DigitizationRegistryAdapter = "DigitizationRegistryAdapter"
    CatalogRecordProperty = "CatalogRecordProperty"
    DocumentProperty = "DocumentProperty"
