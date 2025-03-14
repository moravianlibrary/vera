from typing import List, Optional

from pydantic import BaseModel

from custom_types import CatalogFetchStatus

from .marc import MarcRecord


class CatalogGetResponse(BaseModel):
    record: Optional[MarcRecord] = None
    status: CatalogFetchStatus


class CatalogSearchItem(BaseModel):
    base: str
    system_number: str
    record: MarcRecord


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
