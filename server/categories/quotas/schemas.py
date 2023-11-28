from pydantic import BaseModel
from typing import Optional


class QuotaCreate(BaseModel):
    name: str
    description: Optional[str] = None
    pages_count: int
    active: bool = True


class Quota(QuotaCreate):
    id: int
