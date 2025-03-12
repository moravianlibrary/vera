from pydantic import BaseModel
from typing import Optional
from custom_types import DRFetchStatus, DRState


class DRAdapterResponse(BaseModel):
    source: str
    id: Optional[str] = None
    recordState: Optional[DRState] = None
    issueState: Optional[DRState] = None
    status: DRFetchStatus
