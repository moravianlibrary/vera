from .base_index_model import (
    BaseIndexModel,
    Keyword,
    Date,
    Boolean,
    Nested,
)
from .base_indexer import BaseIndexer
from pydantic import model_validator
from typing import Any
from services.external.aleph import AlephRecord
from .index_document import IndexFrequency
from models import CatalogRecord


class MarcSubfield(BaseIndexModel):
    code: Keyword
    value: Keyword


class MarcFieldBase(BaseIndexModel):
    tag: Keyword
    ind1: Keyword
    ind2: Keyword
    control_field: Boolean


class MarcField(MarcFieldBase):
    data: Keyword
    subfields: Nested[MarcSubfield]


class MarcRecord(BaseIndexModel):
    leader: Keyword
    fields: Nested[MarcField]


class MarcSubfieldDifference(MarcSubfield):
    different_to: Keyword
    differs: Boolean


class MarcFieldDifference(MarcFieldBase):
    difference_type: Keyword
    subfield_differences: Nested[MarcSubfieldDifference]


class IndexCatalogRecord(BaseIndexModel):
    __index_name__ = "catalog_records"
    __index_version__ = "v2024.09-1"

    id: Keyword  # sysno
    main_record: MarcRecord

    cnb: Keyword
    language: Keyword
    signature: Keyword
    isxn: Keyword
    barcodes: Nested[Keyword]

    skc_sysno: Keyword
    skc_record: MarcRecord
    skc_difference: Nested[MarcFieldDifference]
    has_valid_main_record: Boolean

    cnb_sysno: Keyword
    cnb_record: MarcRecord
    cnb_difference: Nested[MarcFieldDifference]
    has_valid_cnb: Boolean

    added_at: Date
    updated_at: Date

    # Other properties
    material_type: Keyword
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
        if not isinstance(data, CatalogRecord):
            return data

        aleph_record = AlephRecord(data.sysno, data.main_record)

        return IndexCatalogRecord(
            id=data.sysno,
            main_record=data.main_record,
            cnb=data.cnb,
            language=data.language,
            signature=data.signature,
            isxn=data.isxn,
            barcodes=data.barcodes,
            skc_sysno=data.skc_sysno,
            skc_record=data.skc_record,
            skc_difference=data.skc_difference,
            has_valid_main_record=data.has_valid_main_record,
            cnb_sysno=data.cnb_sysno,
            cnb_record=data.cnb_record,
            cnb_difference=data.cnb_difference,
            has_valid_cnb=data.has_valid_cnb,
            added_at=data.added_at.isoformat(),
            updated_at=data.updated_at.isoformat(),
            material_type=aleph_record.material_type,
            title=aleph_record.title,
            size=aleph_record.size,
            location_uri=aleph_record.location_uri,
            publisher=aleph_record.publisher,
            publishing_place=aleph_record.publishing_place,
            publishing_year=aleph_record.publishing_year,
            languages=aleph_record.languages,
            frequencies=[
                IndexFrequency(
                    frequency=frequency.frequency, data=frequency.data
                )
                for frequency in aleph_record.frequencies
            ],
        )


class CatalogRecordsIndexer(BaseIndexer):
    pass
