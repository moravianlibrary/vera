from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from schemas.catalog_records import (
    CatalogDocument,
    Identifier,
)
from schemas.types.documents_types import AddDocumentResponseStatus
from services.external.aleph.types import IssuanceType
from services.external.digitization_registry.types import DigitizationState


class AddDocumentResponse(BaseModel):
    identifier: Identifier
    status: AddDocumentResponseStatus
    document: Optional[CatalogDocument] = None


class Document(BaseModel):
    id: int

    sysno: str
    barcode: Optional[str]
    volume: Optional[str]
    volume_year: Optional[str]
    bundle: Optional[str]
    issuance_type: Optional[IssuanceType]

    cnb: Optional[str]
    signature: Optional[str]
    isxn: Optional[str]

    added_by: str
    added_at: datetime
    category_id: int
    category_name: str
    category_path: str

    digitization_registry_id: Optional[int]
    digitization_state: DigitizationState

    pages_count: Optional[int]
    pages_count_catalog: Optional[int]
    pages_count_manual: Optional[int]
    pages_count_predicted: Optional[int]

    dedicated_scanner: Optional[str]
    extraction_priority: int

    is_extractable: bool
    extraction_id: Optional[int]
    extractor: Optional[str]
    extracted_at: Optional[datetime]

    comments_count: int = 0

    class Config:
        arbitrary_types_allowed = True
        from_attributes = True
