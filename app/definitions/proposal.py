from enum import Enum


class ProposalStatus(Enum):
    Enqueued = "Enqueued"
    Pending = "Pending"
    Accepted = "Accepted"
    Declined = "Declined"
