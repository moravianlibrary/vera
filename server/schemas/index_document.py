from .base_es_model import (
    BaseEsModel,
    Integer,
    Keyword,
    Date,
    Boolean,
    Nested,
)
from pydantic import model_validator
from typing import Any
from models import Document
from services.external.aleph import AlephRecord
from .parsers.volume_parser import (
    parse_volume,
    parse_volume_year,
    parse_bundle,
)


class CategoryPath(BaseEsModel):
    category_id: Integer
    category_name: Keyword


class IndexFrequency(BaseEsModel):
    frequency: Keyword
    date: Keyword


class IndexDocument(BaseEsModel):
    __index_name__ = "documents"
    __index_version__ = "v2024.09-1"

    id: Integer
    # Main identifiers
    sysno: Keyword
    barcode: Keyword
    volume: Keyword
    volume_number: Integer
    volume_year: Keyword
    volume_year_number: Integer
    bundle: Keyword
    bundle_number: Integer
    # Librarian identifiers
    cnb: Keyword
    signature: Keyword
    isxn: Keyword
    # VERA properties
    added_at: Date
    added_by: Keyword
    category_id: Integer
    category_path: Nested[CategoryPath]
    skc_sysno: Keyword
    has_valid_main_record: Boolean
    cnb_sysno: Keyword
    has_valid_cnb: Boolean
    digitization_registry_id: Integer
    digitization_state: Keyword
    # Page count
    page_count: Integer
    page_count_catalog: Integer
    page_count_predicted: Integer
    page_count_manual: Integer
    # Extraction properties
    dedicated_scanner: Keyword
    extraction_priority: Integer
    is_extractable: Boolean
    digitization_list_id: Integer
    # Other properties
    material_type: Keyword
    issuance_type: Keyword
    title: Keyword
    size: Keyword
    location_uri: Keyword
    # Publication properties
    publisher: Keyword
    publishing_place: Keyword
    publishing_year: Keyword
    languages: Keyword
    frequencies: Nested[IndexFrequency]

    @model_validator(mode="before")
    @classmethod
    def flatten_tuple(cls, data: Any) -> Any:
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
            dedicated_scanner=data.dedicated_scanner,
            extraction_priority=data.extraction_priority,
            is_extractable=data.is_extractable,
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
            location_uri=aleph_record.locationUri,
            publisher=aleph_record.publisher,
            publishing_place=aleph_record.publishing_place,
            publishing_year=aleph_record.publishing_year,
            languages=aleph_record.languages,
            frequencies=[
                frequency.to_dict() for frequency in aleph_record.frequencies
            ],
        )
