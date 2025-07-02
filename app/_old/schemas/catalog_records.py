from datetime import datetime
from typing import Any, List, Optional

from datatypes import CnbRecordFlag, MarcFieldDifferenceType, SkcRecordFlag
from models import CatalogRecord
from mzk_aleph import AlephMzkRecord, MaterialType
from pydantic import field_validator, model_validator

from config import VeraConfig

from .base_es_model import BaseEsModel, Date, bool, int, str
from .documents import Frequency


class MarcSubfield(BaseEsModel):
    code: str
    value: str


class MarcFieldBase(BaseEsModel):
    tag: str
    ind1: Optional[str] = None
    ind2: Optional[str] = None
    control_field: bool = False


class MarcField(MarcFieldBase):
    data: Optional[str] = None
    subfields: List[MarcSubfield] = []


class MarcRecord(BaseEsModel):
    class Config:
        from_attributes = True

    leader: str
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

    id: int
    code: Optional[str]
    value: Optional[str]
    different_to: Optional[str]
    differs: bool


class MarcFieldDifference(MarcFieldBase):
    class Config:
        from_attributes = True

    id: int
    difference_type: MarcFieldDifferenceType
    subfield_differences: List[MarcSubfieldDifference]

    approved_by: Optional[str]
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

    id: str  # sysno
    main_record: MarcRecord

    cnb: Optional[str]
    language: str
    signature: Optional[str]
    isxn: Optional[str]
    barcodes: List[str]

    skc_sysno: Optional[str]
    skc_record: Optional[MarcRecord]
    skc_difference: List[MarcFieldDifference]
    skc_record_flags: List[SkcRecordFlag]
    skc_difference_tag_facets: List[str]

    cnb_sysno: Optional[str]
    cnb_record: Optional[MarcRecord]
    cnb_difference: List[MarcFieldDifference]
    cnb_record_flags: List[CnbRecordFlag]
    cnb_difference_tag_facets: List[str]

    has_documents: bool
    has_active_documents: bool

    added_at: datetime
    updated_at: datetime
    indexed_at: datetime

    # Other properties
    material_type: Optional[MaterialType]
    title: Optional[str]
    size: Optional[str]
    location_uri: Optional[str]

    # Publication properties
    publisher: Optional[str]
    publishing_place: Optional[str]
    publishing_year: Optional[str]
    languages: List[str]
    frequencies: List[Frequency]

    @model_validator(mode="before")
    @classmethod
    def from_model(cls, data: Any) -> Any:
        if not isinstance(data, CatalogRecord):
            return data

        data: CatalogRecord
        aleph_record = AlephMzkRecord(data.main_record, sysno=data.sysno)

        def extract_diff_type_facets(
            differences: List[MarcFieldDifference],
        ) -> List[str]:
            return (
                list(
                    {
                        difference.difference_type.value
                        for difference in differences
                    }
                )
                if differences
                else []
            )

        def extract_diff_tag_facets(
            differences: List[MarcFieldDifference],
        ) -> List[str]:
            return (
                list({difference.tag for difference in differences})
                if differences
                else []
            )

        def skc_record_flags(
            differences: List[MarcFieldDifference], found: bool, is_valid: bool
        ) -> List[str]:
            if not found:
                return [SkcRecordFlag.NotFound]
            flags = extract_diff_type_facets(differences)
            if is_valid:
                flags.append(SkcRecordFlag.Valid)
            return flags

        def cnb_record_flags(
            differences: List[MarcFieldDifference],
            without_cnb: bool,
            found: bool,
            is_valid: bool,
        ) -> List[str]:
            if without_cnb and not found:
                return [CnbRecordFlag.ShouldNotHaveCnb]
            if not found:
                return [CnbRecordFlag.NotFound]
            flags = extract_diff_type_facets(differences)
            if is_valid:
                flags.append(CnbRecordFlag.Valid)
            return flags

        return IndexCatalogRecord(
            id=data.sysno,
            main_record=data.main_record.as_dict(),
            cnb=data.cnb,
            language=data.language,
            signature=data.signature,
            isxn=data.isxn,
            barcodes=data.barcodes,
            skc_sysno=data.skc_sysno,
            skc_record=data.skc_record.as_dict() if data.skc_record else None,
            skc_difference=data.skc_difference,
            skc_record_flags=skc_record_flags(
                data.skc_difference,
                data.skc_sysno_resolved,
                data.has_valid_main_record,
            ),
            skc_difference_tag_facets=extract_diff_tag_facets(
                data.skc_difference
            ),
            cnb_sysno=data.cnb_sysno,
            cnb_record=data.cnb_record.as_dict() if data.cnb_record else None,
            cnb_difference=data.cnb_difference,
            cnb_record_flags=cnb_record_flags(
                data.cnb_difference,
                data.without_cnb,
                data.cnb_sysno_resolved,
                data.has_valid_cnb,
            ),
            cnb_difference_tag_facets=extract_diff_tag_facets(
                data.cnb_difference
            ),
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
