from enum import Enum
from typing import Literal


class CatalogRecordMarcProperty(str, Enum):
    MaterialType = "material_type"


class DocumentMarcIssueProperty(str, Enum):
    VolumeNumber = "volume_number"
    VolumeYear = "volume_year"
    Bundle = "bundle"
    IssuanceType = "issuance_type"


class PluginType(str, Enum):
    IdentityProvider = "IdentityProvider"
    CatalogAdapter = "CatalogAdapter"
    DigitizationRegistryAdapter = "DigitizationRegistryAdapter"
    CatalogRecordValidity = "CatalogRecordValidity"
    CatalogRecordMarcProperty = "CatalogRecordMarcProperty"
    CatalogRecordProperty = "CatalogRecordProperty"
    DocumentPageCount = "DocumentPageCount"
    DocumentCanBeExtracted = "DocumentCanBeExtracted"
    DocumentMarcIssueProperty = "DocumentMarcIssueProperty"
    DocumentProperty = "DocumentProperty"
    DocumentDiscovery = "DocumentDiscovery"


type PluginTypeCardinality = Literal["1", "0..1", "0..*", "1..*"]
