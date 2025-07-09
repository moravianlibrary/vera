from enum import Enum
from typing import Literal


class PluginType(str, Enum):
    IdentityProvider = "IdentityProvider"
    CatalogAdapter = "CatalogAdapter"
    DigitizationRegistryAdapter = "DigitizationRegistryAdapter"
    CatalogRecordValidity = "CatalogRecordValidity"
    CatalogRecordProperty = "CatalogRecordProperty"
    DocumentPageCount = "DocumentPageCount"
    DocumentCanBeExtracted = "DocumentCanBeExtracted"
    DocumentProperty = "DocumentProperty"
    DocumentDiscovery = "DocumentDiscovery"


class PluginState(Enum):
    Ready = "Ready"
    NewVersionAvailable = "NewVersionAvailable"
    SourceUnavailable = "SourceUnavailable"


type PluginTypeCardinality = Literal["1", "0..1", "0..*", "1..*"]
