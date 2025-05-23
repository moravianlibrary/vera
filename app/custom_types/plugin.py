from enum import Enum


class PluginType(Enum):
    CatalogAdapter = "CatalogAdapter"
    DigitizationRegistryAdapter = "DigitizationRegistryAdapter"
    CatalogRecordProperty = "CatalogRecordProperty"
    DocumentProperty = "DocumentProperty"


class PluginState(Enum):
    Ready = "Ready"
    NewVersionAvailable = "NewVersionAvailable"
    SourceUnavailable = "SourceUnavailable"
