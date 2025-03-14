from pydantic import BaseModel
from typing import List
from custom_types import DRFetchStatus, DRState


class DRAdapterResponse(BaseModel):
    source: str
    recordId: str | None = None
    recordState: List[DRState] | None = None
    certainty: float | None = None
    issueId: str | None = None
    issueState: DRState | None = None
    status: DRFetchStatus
