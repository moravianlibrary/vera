from typing import List, Optional, Dict
from pydantic import BaseModel
from custom_types import CatalogFetchStatus


type Record = Dict


class CatalogGetResponse(BaseModel):
    record: Optional[Record] = None
    status: CatalogFetchStatus


class CatalogSearchItem(BaseModel):
    base: str
    system_number: str
    record: Record


class CatalogSearchResponse(BaseModel):
    items: Optional[List[CatalogSearchItem]] = None
    num_found: int
    status: CatalogFetchStatus


class CatalogSearchParams(BaseModel):
    value: str
    base: Optional[str] = None
    field: Optional[str] = None
    page: int
    page_size: int
