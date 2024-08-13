from pydantic import BaseModel, validator
from typing import List, Optional
from pymarc import Record, MARCReader
from datatypes import IdentifierType
from services.external.aleph import AlephRecord
from services.external.aleph import AlephIssue
from services.external.aleph import MaterialType, IssuanceType
from services.external.digitization_registry import (
    DigitizationRegistryRecord,
)
from services.external.digitization_registry import DigitizationState
from models import CatalogRecord
from services.marc_records_comparator.schemas import MarcFieldDifference


class Identifier(BaseModel):
    identifier_type: IdentifierType
    value: str


class CatalogIssueResponse(BaseModel):
    issuance_type: Optional[IssuanceType] = None
    barcode: Optional[str] = None
    volume: Optional[str] = None
    volume_year: Optional[str] = None
    bundle: Optional[str] = None
    signature: Optional[str] = None

    digitization_registry_id: Optional[int] = None
    digitization_state: DigitizationState = DigitizationState.NotDigitized

    can_digitize: bool = True
    already_added: bool = False

    @classmethod
    def from_aleph_issue(
        cls,
        aleph_record: AlephRecord,
        aleph_issue: AlephIssue,
        digitization_registry_record: DigitizationRegistryRecord,
        already_added: bool,
    ) -> "CatalogIssueResponse":
        return cls(
            issuance_type=aleph_issue.issuance_type,
            barcode=aleph_issue.barcode,
            volume=aleph_issue.volume,
            volume_year=aleph_issue.volume_year,
            bundle=aleph_issue.bundle,
            signature=aleph_issue.signature or aleph_record.signature,
            digitization_registry_id=(
                digitization_registry_record.id
                if digitization_registry_record
                else None
            ),
            digitization_state=(
                digitization_registry_record.digitization_state
                if digitization_registry_record
                else DigitizationState.NotDigitized
            ),
            can_digitize=aleph_issue.can_digitize,
            already_added=already_added,
        )

    @classmethod
    def from_aleph_record(
        cls,
        aleph_record: AlephRecord,
        digitization_registry_record: DigitizationRegistryRecord,
        already_added: bool,
    ) -> "CatalogIssueResponse":
        return cls(
            signature=aleph_record.signature,
            digitization_registry_id=(
                digitization_registry_record.id
                if digitization_registry_record
                else None
            ),
            digitization_state=(
                digitization_registry_record.digitization_state
                if digitization_registry_record
                else DigitizationState.NotDigitized
            ),
            already_added=already_added,
        )


class CatalogRecordResponse(BaseModel):
    sysno: str
    marc: Record

    skc_sysno: Optional[str]
    skc_marc: Optional[Record]
    skc_score: Optional[int]

    cnb_sysno: Optional[str]
    cnb_marc: Optional[Record]
    cnb_score: Optional[int]

    last_updated: Optional[str]

    @validator("marc", "skc_marc", "cnb_marc", pre=True)
    def parse_marc(cls, value):
        if value:
            return cls.convert_to_record(value)
        return None

    @staticmethod
    def convert_to_record(data: bytes) -> Optional[Record]:
        with MARCReader(data) as reader:
            for record in reader:
                return record
        return None

    class Config:
        arbitrary_types_allowed = True
        from_attributes = True


class CatalogDocumentResponse(BaseModel):
    sysno: str
    title: str
    material_type: MaterialType
    issues: List[CatalogIssueResponse]

    skc_sysno: Optional[str] = None
    skc_diff: Optional[MarcFieldDifference] = None
    cnb_sysno: Optional[str] = None
    cnb_diff: Optional[MarcFieldDifference] = None

    @classmethod
    def from_records(
        cls,
        aleph_record: AlephRecord,
        catalog_issues: List[CatalogIssueResponse],
        catalog_record: CatalogRecord,
    ) -> "CatalogDocumentResponse":
        return cls(
            sysno=aleph_record.sysno,
            title=aleph_record.title,
            material_type=aleph_record.material_type,
            issues=catalog_issues,
            skc_sysno=catalog_record.skc_sysno,
            skc_diff=catalog_record.skc_diff,
            cnb_sysno=catalog_record.cnb_sysno,
            cnb_diff=catalog_record.cnb_diff,
        )


class Frequency(BaseModel):
    frequency: str
    date: Optional[str] = None

    class Config:
        arbitrary_types_allowed = True


class MarcDifferenceRecord(BaseModel):
    differences: List[MarcFieldDifference] = []

    sysno1: Optional[str] = None
    sysno2: Optional[str] = None
