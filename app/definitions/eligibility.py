from enum import Enum


class EligibilityStatus(Enum):
    Eligible = "Eligible"
    ActiveDuplicate = "ActiveDuplicate"
    FullyProcessedDuplicate = "FullyProcessedDuplicate"
    InDigitization = "InDigitization"
    DigitizationForbidden = "DigitizationForbidden"
    AmbiguousIssues = "AmbiguousIssues"
    AllIssuesResolved = "AllIssuesResolved"
    CatalogFailure = "CatalogFailure"
    DigitizationRegistryFailure = "DigitizationRegistryFailure"
    InternalFailure = "InternalFailure"
