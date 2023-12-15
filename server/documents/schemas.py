from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from documents.enums import IdentifierType
from catalogs.enums import DigitizationState, DocumentCreateResult, \
    MaterialType, IssuanceType


class Identifier(BaseModel):
    identifier_type: IdentifierType
    value: str


class DocumentBase(BaseModel):
    sysno: str
    volume_number: Optional[str] = None

    signature: Optional[str] = None
    barcode: Optional[str] = None
    ccnb: Optional[str] = None
    isbn: Optional[str] = None

    material_type: Optional[MaterialType] = None
    title: str
    publishers: Optional[List[str]] = None

    pages_count: Optional[int] = None
    size: Optional[str] = None


class Issue(BaseModel):
    signature: Optional[str] = None
    year_issued: Optional[str] = None
    volume: Optional[str] = None
    item: Optional[str] = None
    barcode: Optional[str] = None
    issuance_type: IssuanceType
    digitization_state: Optional[DigitizationState] = None
    already_exists: bool = False


class DocumentCatalog(DocumentBase):
    periodicity: Optional[str] = None
    publishing_date: Optional[str] = None
    issues: List[Issue]


class DocumentCatalogResponse(BaseModel):
    identifier: Identifier
    document: Optional[DocumentCatalog] = None
    digitization_state: Optional[DigitizationState] = None
    create_result: DocumentCreateResult


class DocumentCreate(DocumentBase):
    category_id: Optional[int] = None
    digitization_state: Optional[DigitizationState] = None

    @classmethod
    def from_catalog_document(
            cls, catalog_document: DocumentCatalog,
            category_id: Optional[int],
            digitization_state: Optional[DigitizationState]
            ) -> "DocumentCreate":
        return cls(
            sysno=catalog_document.sysno,
            volume_number=catalog_document.volume_number,
            signature=catalog_document.signature,
            barcode=catalog_document.barcode,
            ccnb=catalog_document.ccnb,
            isbn=catalog_document.isbn,
            material_type=catalog_document.material_type,
            title=catalog_document.title,
            publishers=catalog_document.publishers,
            pages_count=catalog_document.pages_count,
            size=catalog_document.size,
            category_id=category_id,
            digitization_state=digitization_state
        )

    @classmethod
    def from_catalog_document_issue(
            cls, catalog_document: DocumentCatalog,
            issue: Issue,
            category_id: Optional[int],
            digitization_state: Optional[DigitizationState]
            ) -> "DocumentCreate":
        return cls(
            sysno=catalog_document.sysno,
            volume_number=issue.volume,
            signature=issue.signature,
            barcode=issue.barcode,
            ccnb=catalog_document.ccnb,
            isbn=catalog_document.isbn,
            material_type=catalog_document.material_type,
            title=catalog_document.title,
            publishers=catalog_document.publishers,
            pages_count=catalog_document.pages_count,
            size=catalog_document.size,
            category_id=category_id,
            digitization_state=digitization_state
        )


class Document(DocumentCreate):
    id: int

    creator_id: int
    created_at: datetime

    extraction_id: Optional[int] = None


class DocumentView(Document):
    category_name: Optional[str]

    creator: str
    creator_department_id: Optional[int] = None

    extractor_id: Optional[int] = None
    extractor: Optional[str] = None
    extracted_at: Optional[datetime] = None

    comments_count: int = 0

    class Config:
        arbitrary_types_allowed = True
        from_attributes = True


class DocumentCreateResponse(BaseModel):
    identifier: Identifier
    document: Optional[DocumentView] = None
    catalog_document: Optional[DocumentCatalog] = None
    digitization_state: Optional[DigitizationState] = None
    create_result: DocumentCreateResult


class DocumentsQuery(BaseModel):
    id_list: Optional[List[int]] = None

    sysno: Optional[str] = None
    volume_number: Optional[str] = None

    material_type: Optional[List[MaterialType]] = None
    title: Optional[str] = None
    publishers: Optional[str] = None

    category_id: Optional[int] = None
    digitization_state: Optional[DigitizationState] = None

    pages_count_min: Optional[int] = None
    pages_count_max: Optional[int] = None
    size: Optional[str] = None

    signature: Optional[str] = None
    barcode: Optional[str] = None
    ccnb: Optional[str] = None
    isbn: Optional[str] = None

    creator_id: Optional[List[int]] = None
    creator_department_id: Optional[int] = None
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None

    extraction_id: Optional[int] = None
    extractor_id: Optional[int] = None
    extracted_after: Optional[datetime] = None
    extracted_before: Optional[datetime] = None


class DocumentsResponse(BaseModel):
    documents: List[DocumentView]
    num_found: int
