from __future__ import annotations
from pydantic import BaseModel
from typing import List, Optional, Tuple, Union
from datetime import datetime
from documents.enums import (
    DocumentCreateResult,
    DocumentField,
    GroupOption,
    NumberOption,
    TextOption,
    TreeOption,
    SortOrder,
)
from catalogs.enums import (
    DigitizationState,
    MaterialType,
    IssuanceType,
)
from catalogs.schemas import CatalogDocument, CatalogIssue, Frequency


class DocumentBase(BaseModel):
    sysno: Optional[str] = None
    volume: Optional[str] = None
    barcode: Optional[str] = None

    cnb: Optional[str] = None
    isbn_issn: Optional[str] = None
    signature: Optional[str] = None

    material_type: Optional[MaterialType] = None
    issuance_type: Optional[IssuanceType] = None
    title: Optional[str] = None
    digitization_state: Optional[DigitizationState] = None

    year: Optional[str] = None
    bundle: Optional[str] = None

    pages_count: Optional[int] = None
    pages_count_manual: Optional[int] = None
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
    category_id: Optional[int] = None

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
            pages_count=catalog_document.pages_count,
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
            pages_count=catalog_document.pages_count,
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


class Document(DocumentCreate):
    id: int

    pages_count_predicted: Optional[int]
    dedicated_scanner: Optional[str]

    creator: str
    created_at: datetime

    extraction_id: Optional[int] = None


class DocumentView(Document):
    category_name: Optional[str]

    extractor: Optional[str] = None
    extracted_at: Optional[datetime] = None

    comments_count: int = 0

    class Config:
        arbitrary_types_allowed = True
        from_attributes = True


class DocumentCreateResponse(BaseModel):
    document: Optional[DocumentView] = None
    catalog_document: Optional[CatalogDocument] = None
    create_result: DocumentCreateResult


class SearchField(BaseModel):
    field: DocumentField
    option: Union[TextOption, NumberOption, TreeOption]
    value: Optional[Union[str, int, Tuple[int, int], List[int]]]


class SearchGroup(BaseModel):
    option: GroupOption
    sub_rules: List[Union[SearchGroup, SearchField]]


class QuerySort(BaseModel):
    field: DocumentField
    order: SortOrder = SortOrder.Descending
    and_then: Optional[QuerySort] = None


class DocumentsQuery(BaseModel):
    id_list: Optional[List[int]] = None
    search_phrase: Optional[str] = None
    search_group: Optional[SearchGroup] = None
    department_id: Optional[int] = None
    username: Optional[str] = None
    sort: Optional[QuerySort] = None


class DocumentsResponse(BaseModel):
    documents: List[DocumentView]
    num_found: int
