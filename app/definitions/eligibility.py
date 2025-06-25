from enum import Enum


class EligibilityStatus(Enum):
    CatalogFailure = "CatalogFailure"
    RecordNotFound = "RecordNotFound"
    MultipleRecordsFound = "MultipleRecordsFound"
    IssueNotFound = "IssueNotFound"
    AmbiguousIssues = "AmbiguousIssues"
    DigitizationForbidden = "DigitizationForbidden"
    DigitizationRegistryFailure = "DigitizationRegistryFailure"
    ActiveDuplicate = "ActiveDuplicate"
    FullyProcessedDuplicate = "FullyProcessedDuplicate"
    InDigitization = "InDigitization"
    Eligible = "Eligible"
