from enum import Enum


class DocumentProposalStatus(Enum):
    Enqueued = "Enqueued"
    Processing = "Processing"
    NotEligibleForProposal = "NotEligibleForProposal"
    Pending = "Pending"
    Accepted = "Accepted"
    Declined = "Declined"
