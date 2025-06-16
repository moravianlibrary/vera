from pydantic import BaseModel
from datetime import datetime
from .base_es_model import BaseEsModel, Integer, Keyword, Date, List
from pydantic import model_validator
from typing import Any, Optional
from models import Document
from mzk_aleph import AlephMzkRecord, MaterialType, IssuanceType
from .parsers.volume_parser import (
    parse_volume,
    parse_volume_year,
    parse_bundle,
)
from datatypes import (
    DocumentFlag,
    DigitizationState,
)
from config import VeraConfig


class CategoryPath(BaseEsModel):
    category_id: Integer
    category_name: Keyword


class Frequency(BaseEsModel):
    frequency: Keyword
    date: Optional[Keyword]


class Comment(BaseModel):
    id: int
    document_id: int
    user_id: int
    created_at: datetime
    edited_at: Optional[datetime] = None

    class Config:
        arbitrary_types_allowed = True
        from_attributes = True


def DocumentFlagsDispatcher(document: Document) -> List[str]:
    flags = []
    if document.digitization_list_id is not None:
        flags.append(DocumentFlag.AlreadyExtracted.value)
    elif document.is_extractable:
        flags.append(DocumentFlag.IsExtractable.value)
    else:
        flags.append(DocumentFlag.IsNotExtractable.value)

    if not document.catalog_record.has_valid_main_record:
        flags.append(DocumentFlag.InvalidMainRecord.value)
    if not document.catalog_record.has_valid_cnb:
        flags.append(DocumentFlag.InvalidCnb.value)
    if document.pages_count is None or document.pages_count == 0:
        flags.append(DocumentFlag.MissingPageCount.value)

    return flags


class IndexDocumentIntention(BaseEsModel):
    id: Integer
    name: Keyword


class IndexDocument(BaseEsModel):
    __index_name__ = "documents"
    __index_version__ = "v2024.10-1"

    class Config:
        from_attributes = True

    id: Integer
    # Main identifiers
    sysno: Keyword
    barcode: Optional[Keyword]
    volume: Optional[Keyword]
    volume_number: Optional[Integer]
    volume_year: Optional[Keyword]
    volume_year_number: Optional[Integer]
    bundle: Optional[Keyword]
    bundle_number: Optional[Integer]
    # Librarian identifiers
    cnb: Optional[Keyword]
    signature: Optional[Keyword]
    isxn: Optional[Keyword]
    # VERA properties
    added_at: Date
    added_by: Keyword
    category_id: Integer
    category_ids: List[Integer]  # Deprecated
    category_path: List[CategoryPath]
    document_flags: List[DocumentFlag]
    # Catalogs properties
    skc_sysno: Optional[Keyword]
    cnb_sysno: Optional[Keyword]
    digitization_registry_id: Optional[Integer]
    digitization_state: DigitizationState
    # Page count
    page_count: Optional[Integer]
    page_count_catalog: Optional[Integer]
    page_count_predicted: Optional[Integer]
    page_count_manual: Optional[Integer]
    # Extraction properties
    dedicated_scanner: Optional[Keyword]
    extraction_priority: Optional[Integer]
    extraction_ids: List[Integer]
    digitization_list_id: Optional[Integer]
    # Other properties
    material_type: Optional[MaterialType]
    issuance_type: Optional[IssuanceType]
    title: Optional[Keyword]
    size: Optional[Keyword]
    location_uri: Optional[Keyword]
    # Publication properties
    publisher: Optional[Keyword]
    publishing_place: Optional[Keyword]
    publishing_year: Optional[Keyword]
    languages: List[Keyword] = []
    frequencies: List[Frequency]
    indexed_at: Date

    @model_validator(mode="before")
    @classmethod
    def from_model(cls, data: Any) -> Any:
        if not isinstance(data, Document):
            return data

        aleph_record = AlephMzkRecord(
            data.catalog_record.main_record, sysno=data.catalog_record.sysno
        )

        return IndexDocument(
            id=data.id,
            sysno=data.sysno,
            barcode=data.barcode,
            volume=data.volume,
            volume_number=parse_volume(data.volume),
            volume_year=data.volume_year,
            volume_year_number=parse_volume_year(data.volume_year),
            bundle=data.bundle,
            bundle_number=parse_bundle(data.bundle),
            cnb=data.cnb,
            signature=data.signature,
            isxn=data.isxn,
            added_at=data.added_at.isoformat(),
            added_by=data.added_by,
            category_id=data.category_id,
            category_ids=data.category_ids,
            category_path=data.category_path,
            document_flags=DocumentFlagsDispatcher(data),
            # Catalog properties
            skc_sysno=data.catalog_record.skc_sysno,
            cnb_sysno=data.catalog_record.cnb_sysno,
            digitization_registry_id=data.digitization_registry_id,
            digitization_state=(
                data.digitization_state.value
                if data.digitization_state
                else None
            ),
            page_count=data.pages_count,
            page_count_catalog=data.pages_count_catalog,
            page_count_predicted=data.pages_count_predicted,
            page_count_manual=data.pages_count_manual,
            dedicated_scanner=data.dedicated_scanner,
            extraction_priority=data.extraction_priority,
            extraction_ids=data.extraction_ids,
            digitization_list_id=data.digitization_list_id,
            material_type=(
                aleph_record.material_type.value
                if aleph_record.material_type
                else None
            ),
            issuance_type=(
                data.issuance_type.value if data.issuance_type else None
            ),
            title=aleph_record.title,
            size=aleph_record.size,
            location_uri=aleph_record.location_uri,
            publisher=aleph_record.publisher,
            publishing_place=aleph_record.publishing_place,
            publishing_year=aleph_record.publishing_year,
            languages=aleph_record.languages,
            frequencies=[
                Frequency(frequency=frequency.frequency, date=frequency.date)
                for frequency in aleph_record.frequencies
            ],
            indexed_at=VeraConfig.Timestamp.isoformat(),
        )
