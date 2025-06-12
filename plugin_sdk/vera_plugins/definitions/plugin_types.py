from enum import Enum
from typing import Literal


class PluginType(str, Enum):
    CatalogAdapter = "CatalogAdapter"
    CatalogRecordProperty = "CatalogRecordProperty"
    DigitizationRegistryAdapter = "DigitizationRegistryAdapter"
    DocumentDiscovery = "DocumentDiscovery"
    DocumentProperty = "DocumentProperty"
    IdentityProvider = "IdentityProvider"


class PluginState(Enum):
    Ready = "Ready"
    NewVersionAvailable = "NewVersionAvailable"
    SourceUnavailable = "SourceUnavailable"


type PluginTypeCardinality = Literal["1", "0..1", "0..*", "1..*"]
