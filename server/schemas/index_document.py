from .base_es_model import BaseEsModel, Integer, Keyword, Date, Boolean, List
from pydantic import model_validator
from typing import Any, Optional
from models import Document
from services.external.aleph import AlephRecord
from .parsers.volume_parser import (
    parse_volume,
    parse_volume_year,
    parse_bundle,
)
from config import VeraConfig


class CategoryPath(BaseEsModel):
    category_id: Integer
    category_name: Keyword


class IndexFrequency(BaseEsModel):
    frequency: Keyword
    date: Optional[Keyword]


class IndexDocument(BaseEsModel):
    __index_name__ = "documents"
    __index_version__ = "v2024.09-1"

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
    category_ids: List[Integer]
    category_path: List[CategoryPath]
    skc_sysno: Optional[Keyword]
    has_valid_main_record: Boolean
    cnb_sysno: Optional[Keyword]
    has_valid_cnb: Boolean
    digitization_registry_id: Optional[Integer]
    digitization_state: Keyword
    # Page count
    page_count: Optional[Integer]
    page_count_catalog: Optional[Integer]
    page_count_predicted: Optional[Integer]
    page_count_manual: Optional[Integer]
    has_page_count: Boolean
    # Extraction properties
    dedicated_scanner: Optional[Keyword]
    extraction_priority: Optional[Integer]
    is_extractable: Boolean
    extraction_ids: List[Integer]
    digitization_list_id: Optional[Integer]
    # Other properties
    material_type: Optional[Keyword]
    issuance_type: Optional[Keyword]
    title: Optional[Keyword]
    size: Optional[Keyword]
    location_uri: Optional[Keyword]
    # Publication properties
    publisher: Optional[Keyword]
    publishing_place: Optional[Keyword]
    publishing_year: Optional[Keyword]
    languages: List[Keyword] = []
    frequencies: List[IndexFrequency]
    indexed_at: Date

    @model_validator(mode="before")
    @classmethod
    def from_model(cls, data: Any) -> Any:
        if not isinstance(data, Document):
            return data

        aleph_record = AlephRecord(
            data.catalog_record.sysno, data.catalog_record.main_record
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
            # Catalog properties
            skc_sysno=data.catalog_record.skc_sysno,
            has_valid_main_record=(data.catalog_record.has_valid_main_record),
            cnb_sysno=data.catalog_record.cnb_sysno,
            has_valid_cnb=data.catalog_record.has_valid_cnb,
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
            has_page_count=bool(data.pages_count),
            dedicated_scanner=data.dedicated_scanner,
            extraction_priority=data.extraction_priority,
            is_extractable=data.is_extractable,
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
                IndexFrequency(
                    frequency=frequency.frequency, date=frequency.date
                )
                for frequency in aleph_record.frequencies
            ],
            indexed_at=VeraConfig.Timestamp.isoformat(),
        )
