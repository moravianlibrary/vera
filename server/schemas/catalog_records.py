from .base_es_model import BaseEsModel, Keyword, Date, Boolean, Integer
from pydantic import model_validator, field_validator
from typing import Any, List, Optional
from .documents import Frequency
from models import CatalogRecord
from datetime import datetime
from config import VeraConfig
from datatypes import MarcFieldDifferenceType
from mzk_aleph import AlephMzkRecord, MaterialType


class MarcSubfield(BaseEsModel):
    code: Keyword
    value: Keyword


class MarcFieldBase(BaseEsModel):
    tag: Keyword
    ind1: Optional[Keyword] = None
    ind2: Optional[Keyword] = None
    control_field: Boolean = False


class MarcField(MarcFieldBase):
    data: Optional[Keyword] = None
    subfields: List[MarcSubfield] = []


class MarcRecord(BaseEsModel):
    class Config:
        from_attributes = True

    leader: Keyword
    fields: List[MarcField]

    # TODO: split into other models and specialize
    @field_validator("fields", mode="before")
    def parse_fields(cls, fields: Any) -> Any:
        if not isinstance(fields, list):
            return fields

        validated_fields: List[MarcField] = []

        for field in fields:
            for tag, value in field.items():
                if isinstance(value, str):
                    validated_fields.append(
                        MarcField(tag=tag, data=value, control_field=True)
                    )
                elif isinstance(value, dict):
                    if "subfields" in value:
                        validated_fields.append(
                            MarcField(
                                tag=tag,
                                ind1=value.get("ind1"),
                                ind2=value.get("ind2"),
                                subfields=[
                                    MarcSubfield(code=code, value=value)
                                    for subfield in value["subfields"]
                                    for code, value in subfield.items()
                                ],
                                control_field=False,
                            )
                        )
                    else:
                        raise ValueError(
                            f"Invalid MARC field structure for tag {tag}."
                        )
                else:
                    raise ValueError(
                        f"Invalid type for MARC field value: {value}"
                    )

        return validated_fields


class MarcSubfieldDifference(MarcSubfield):
    class Config:
        from_attributes = True

    id: Integer
    code: Optional[Keyword]
    value: Optional[Keyword]
    different_to: Optional[Keyword]
    differs: Boolean


class MarcFieldDifference(MarcFieldBase):
    class Config:
        from_attributes = True

    id: Integer
    difference_type: MarcFieldDifferenceType
    subfield_differences: List[MarcSubfieldDifference]

    approved_by: Optional[Keyword]
    approved_at: Optional[Date]

    @field_validator("approved_at", mode="before")
    def parse_approved_at(cls, approved_at: Any) -> Any:
        if isinstance(approved_at, datetime):
            return approved_at.isoformat()
        return approved_at


class IndexCatalogRecord(BaseEsModel):
    __index_name__ = "catalog_records"
    __index_version__ = "v2024.10-1"

    class Config:
        from_attributes = True

    id: Keyword  # sysno
    main_record: MarcRecord

    cnb: Optional[Keyword]
    language: Keyword
    signature: Optional[Keyword]
    isxn: Optional[Keyword]
    barcodes: List[Keyword]

    skc_sysno: Optional[Keyword]
    skc_sysno_resolved: Boolean
    skc_record: Optional[MarcRecord]
    skc_difference: List[MarcFieldDifference]
    skc_difference_type_facets: List[MarcFieldDifferenceType]
    skc_difference_tag_facets: List[Keyword]
    has_valid_main_record: Boolean

    cnb_sysno: Optional[Keyword]
    cnb_sysno_resolved: Boolean
    cnb_record: Optional[MarcRecord]
    cnb_difference: List[MarcFieldDifference]
    cnb_difference_type_facets: List[MarcFieldDifferenceType]
    cnb_difference_tag_facets: List[Keyword]
    has_valid_cnb: Boolean

    has_documents: Boolean
    has_active_documents: Boolean

    added_at: Date
    updated_at: Date
    indexed_at: Date

    # Other properties
    material_type: Optional[MaterialType]
    title: Optional[Keyword]
    size: Optional[Keyword]
    location_uri: Optional[Keyword]

    # Publication properties
    publisher: Optional[Keyword]
    publishing_place: Optional[Keyword]
    publishing_year: Optional[Keyword]
    languages: List[Keyword]
    frequencies: List[Frequency]

    @model_validator(mode="before")
    @classmethod
    def from_model(cls, data: Any) -> Any:
        if not isinstance(data, CatalogRecord):
            return data

        aleph_record = AlephMzkRecord(data.main_record, sysno=data.sysno)

        def extract_diff_type_facets(
            differences: List[MarcFieldDifference],
        ) -> List[Keyword]:
            return (
                list(
                    {difference.difference_type for difference in differences}
                )
                if differences
                else []
            )

        def extract_diff_tag_facets(
            differences: List[MarcFieldDifference],
        ) -> List[Keyword]:
            return (
                list({difference.tag for difference in differences})
                if differences
                else []
            )

        return IndexCatalogRecord(
            id=data.sysno,
            main_record=data.main_record.as_dict(),
            cnb=data.cnb,
            language=data.language,
            signature=data.signature,
            isxn=data.isxn,
            barcodes=data.barcodes,
            skc_sysno=data.skc_sysno,
            skc_sysno_resolved=data.skc_sysno_resolved,
            skc_record=data.skc_record.as_dict() if data.skc_record else None,
            skc_difference=data.skc_difference,
            skc_difference_type_facets=extract_diff_type_facets(
                data.skc_difference
            ),
            skc_difference_tag_facets=extract_diff_tag_facets(
                data.skc_difference
            ),
            has_valid_main_record=data.has_valid_main_record,
            cnb_sysno=data.cnb_sysno,
            cnb_sysno_resolved=data.cnb_sysno_resolved,
            cnb_record=data.cnb_record.as_dict() if data.cnb_record else None,
            cnb_difference=data.cnb_difference,
            cnb_difference_type_facets=extract_diff_type_facets(
                data.cnb_difference
            ),
            cnb_difference_tag_facets=extract_diff_tag_facets(
                data.cnb_difference
            ),
            has_valid_cnb=data.has_valid_cnb,
            has_documents=data.has_documents,
            has_active_documents=data.has_active_documents,
            added_at=data.added_at.isoformat(),
            updated_at=data.updated_at.isoformat(),
            indexed_at=VeraConfig.Timestamp.isoformat(),
            material_type=aleph_record.material_type,
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
        )
