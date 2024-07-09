from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from schemas.types.document_create_result import DocumentCreateResult
from catalogs.enums import (
    DigitizationState,
    MaterialType,
    IssuanceType,
)
from catalogs.schemas import (
    CatalogDocument,
    Frequency,
    Identifier,
)


class CatalogIssue(BaseModel):
    title: Optional[str] = None

    issuance_type: IssuanceType
    barcode: Optional[str]
    volume: Optional[str] = None
    volume_year: Optional[str] = None
    bundle: Optional[str] = None

    signature: Optional[str] = None
    digitization_registry_id: Optional[int] = None
    digitization_state: DigitizationState = DigitizationState.NotDigitized

    already_exists: bool = False
    can_digitize: bool = True


class Document(BaseModel):
    id: int

    sysno: str
    barcode: Optional[str]
    volume: Optional[str]
    volume_year: Optional[str]
    bundle: Optional[str]

    cnb: Optional[str]
    signature: Optional[str]
    isxn: Optional[str]

    added_by: str
    added_at: datetime
    category_id: int
    category_name: str

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


class AddDocumentResponse(BaseModel):
    identifier: Identifier
    create_result: DocumentCreateResult
    document: Optional[Document] = None


class DocumentBase(BaseModel):

    material_type: Optional[MaterialType] = None
    issuance_type: Optional[IssuanceType] = None
    title: Optional[str] = None

    year: Optional[str] = None
    bundle: Optional[str] = None

    size: Optional[str] = None
    locationUri: Optional[str] = None

    publishers: Optional[List[str]] = None
    publishing_places: Optional[List[str]] = None

    publisher: Optional[str] = None
    publishing_place: Optional[str] = None
    publishing_year: Optional[str] = None
    languages: Optional[List[str]] = None

    frequencies: Optional[List[Frequency]] = None


class DocumentCreate(DocumentBase):

    @classmethod
    def from_catalog_document(
        cls,
        catalog_document: CatalogDocument,
        category_id: Optional[int],
    ) -> "DocumentCreate":
        return cls(
            sysno=catalog_document.sysno,
            volume=catalog_document.volume,
            barcode=catalog_document.barcode,
            cnb=catalog_document.cnb,
            isbn_issn=catalog_document.isbn_issn,
            signature=catalog_document.signature,
            material_type=catalog_document.material_type,
            title=catalog_document.title,
            digitization_state=catalog_document.digitization_state,
            year=catalog_document.year,
            bundle=catalog_document.bundle,
            pages_count_catalog=catalog_document.pages_count,
            size=catalog_document.size,
            locationUri=catalog_document.locationUri,
            publishers=catalog_document.publishers,
            publishing_places=catalog_document.publishing_places,
            publisher=catalog_document.publisher,
            publishing_place=catalog_document.publishing_place,
            publishing_year=catalog_document.publishing_year,
            languages=catalog_document.languages,
            frequencies=catalog_document.frequencies,
            category_id=category_id,
        )

    @classmethod
    def from_catalog_issue(
        cls,
        catalog_document: CatalogDocument,
        catalog_issue: CatalogIssue,
        category_id: Optional[int],
    ) -> "DocumentCreate":
        return cls(
            sysno=catalog_document.sysno,
            volume=catalog_issue.volume,
            barcode=catalog_issue.barcode,
            cnb=catalog_document.cnb,
            isbn_issn=catalog_document.isbn_issn,
            signature=(
                catalog_issue.signature
                if catalog_issue.signature
                else catalog_document.signature
            ),
            material_type=catalog_document.material_type,
            issuance_type=catalog_issue.type,
            title=catalog_document.title,
            digitization_state=catalog_issue.digitization_state,
            year=catalog_issue.year,
            bundle=catalog_issue.bundle,
            pages_count_catalog=catalog_document.pages_count,
            size=catalog_document.size,
            locationUri=catalog_document.locationUri,
            publishers=catalog_document.publishers,
            publishing_places=catalog_document.publishing_places,
            publisher=catalog_document.publisher,
            publishing_place=catalog_document.publishing_place,
            publishing_year=catalog_document.publishing_year,
            languages=catalog_document.languages,
            frequencies=catalog_document.frequencies,
            category_id=category_id,
        )
