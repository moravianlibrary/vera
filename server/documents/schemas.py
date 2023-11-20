from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from documents.enums import IdentifierType
from catalogs.enums import MaterialType, IssuanceType


class Identifier(BaseModel):
    identifier_type: IdentifierType
    value: str


class DocumentBase(BaseModel):
    sysno: str
    volume_number: Optional[str] = None
    item_number: Optional[str] = None

    material_type: Optional[MaterialType]
    title: str
    publishers: Optional[List[str]] = None

    pages_count: Optional[int] = None
    size: Optional[str] = None

    signature: Optional[str] = None
    barcode: Optional[str] = None
    ccnb: Optional[str] = None
    isbn: Optional[str] = None


class Issue(BaseModel):
    signature: Optional[str]
    year_issued: Optional[str]
    volume: Optional[str]
    item: Optional[str]
    barcode: Optional[str]
    issuance_type: IssuanceType


class DocumentCatalog(DocumentBase):
    periodicity: Optional[str] = None
    publishing_date: Optional[str] = None
    issues: List[Issue]


class DocumentPrecreateResult(BaseModel):
    record: Optional[DocumentCatalog] = None
    identifier: Identifier
    error_type: Optional[str] = None


class DocumentCreate(DocumentBase):
    category_id: int

    @classmethod
    def from_catalog_document(cls, catalog_document: DocumentCatalog,
                              category_id: int) -> "DocumentCreate":
        return cls(
            sysno=catalog_document.sysno,
            volume_number=catalog_document.volume_number,
            item_number=catalog_document.item_number,
            material_type=catalog_document.material_type,
            title=catalog_document.title,
            publishers=catalog_document.publishers,
            pages_count=catalog_document.pages_count,
            size=catalog_document.size,
            signature=catalog_document.signature,
            barcode=catalog_document.barcode,
            ccnb=catalog_document.ccnb,
            isbn=catalog_document.isbn,
            category_id=category_id
        )


class DocumentCreateResult(BaseModel):
    record: Optional[DocumentCreate]
    identifier: Identifier
    error_type: Optional[str]


class Document(DocumentCreate):
    id: int

    creator_id: int
    created_at: datetime

    extraction_id: Optional[int]


class DocumentView(Document):
    category_name: str

    creator: str
    creator_department_id: Optional[int]

    extractor_id: Optional[int] = None
    extractor: Optional[str] = None
    extracted_at: Optional[datetime] = None

    comments_count: int

    class Config:
        arbitrary_types_allowed = True
        from_attributes = True


class DocumentsResponse(BaseModel):
    records: List[DocumentView]
    num_found: int


class CommentBase(BaseModel):
    text: str


class CommentCreate(CommentBase):
    pass


class Comment(CommentBase):
    id: int
    record_id: int
    user_id: int
    created_at: datetime
    edited_at: Optional[datetime] = None

    class Config:
        arbitrary_types_allowed = True
        from_attributes = True
