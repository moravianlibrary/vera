from enum import Enum


class DocumentEligibilityStatus(Enum):
    Ready = "Ready"
    ActiveDuplicate = "ActiveDuplicate"
    FullyProcessedDuplicate = "FullyProcessedDuplicate"
    InDigitization = "InDigitization"
    DigitizationForbidden = "DigitizationForbidden"
    AmbiguousIssues = "AmbiguousIssues"
    AllIssuesResolved = "AllIssuesResolved"
    CatalogFailure = "CatalogFailure"
    DigitizationRegistryFailure = "DigitizationRegistryFailure"
    InternalFailure = "InternalFailure"
